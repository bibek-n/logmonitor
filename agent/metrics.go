package main

import (
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// pseudoFsTypes excludes virtual/special filesystems that gopsutil's disk.Partitions(false)
// still surfaces on Linux (container overlays, cgroups, kernel interfaces, etc.) - none of
// these represent real disk capacity, and including them would flood the volumes list with
// entries no admin cares about. Windows has no equivalent noise (its drive letters are all
// real volumes), so this filter is a no-op there.
var pseudoFsTypes = map[string]bool{
	"tmpfs": true, "devtmpfs": true, "squashfs": true, "overlay": true, "aufs": true,
	"proc": true, "sysfs": true, "cgroup": true, "cgroup2": true, "mqueue": true,
	"debugfs": true, "tracefs": true, "pstore": true, "bpf": true, "autofs": true,
	"binfmt_misc": true, "hugetlbfs": true, "securityfs": true, "configfs": true,
	"fusectl": true, "ramfs": true, "devpts": true, "efivarfs": true,
}

// HostVersion returns a human-readable platform version string for enrollment (e.g.
// "Windows 10.0.19045" or "Ubuntu 22.04"), best-effort.
func HostVersion() string {
	info, err := host.Info()
	if err != nil {
		return "unknown"
	}
	return info.Platform + " " + info.PlatformVersion
}

// CollectMetrics gathers a single snapshot. Network throughput is measured as the delta
// between two 1-second IOCounters samples (gopsutil only exposes cumulative byte
// counters, not an instantaneous rate) converted to Mbps.
func CollectMetrics() MetricsPayload {
	var out MetricsPayload

	if pct, err := cpu.Percent(0, false); err == nil && len(pct) > 0 {
		out.CpuPct = pct[0]
	}

	if vm, err := mem.VirtualMemory(); err == nil {
		out.MemPct = vm.UsedPercent
	}

	if parts, err := disk.Partitions(false); err == nil {
		var worst float64
		var worstFreeGB, worstTotalGB float64
		seenDevices := map[string]bool{}
		for _, p := range parts {
			usage, err := disk.Usage(p.Mountpoint)
			if err != nil {
				continue
			}
			if usage.UsedPercent > worst {
				worst = usage.UsedPercent
				worstFreeGB = float64(usage.Free) / (1024 * 1024 * 1024)
				worstTotalGB = float64(usage.Total) / (1024 * 1024 * 1024)
			}

			// Same device mounted at multiple points (bind mounts) only needs reporting once,
			// and pseudo-filesystems never represent real disk capacity - see pseudoFsTypes.
			if usage.Total == 0 || pseudoFsTypes[strings.ToLower(p.Fstype)] || seenDevices[p.Device] {
				continue
			}
			seenDevices[p.Device] = true
			out.Volumes = append(out.Volumes, VolumeInfo{
				MountPoint:  p.Mountpoint,
				Device:      p.Device,
				FsType:      p.Fstype,
				TotalGB:     float64(usage.Total) / (1024 * 1024 * 1024),
				FreeGB:      float64(usage.Free) / (1024 * 1024 * 1024),
				UsedPercent: usage.UsedPercent,
			})
		}
		out.DiskPct = worst
		out.DiskFreeGB = worstFreeGB
		out.DiskTotalGB = worstTotalGB
	}

	rates := measureRates()
	out.NetRxMbps = rates.netRxMbps
	out.NetTxMbps = rates.netTxMbps
	out.DiskReadMBps = rates.diskReadMBps
	out.DiskWriteMBps = rates.diskWriteMBps
	out.DiskIops = rates.diskIops
	out.DiskLatencyMs = rates.diskLatencyMs

	if uptime, err := host.Uptime(); err == nil {
		out.UptimeSeconds = int64(uptime)
	}

	return out
}

func totalNetBytes() (uint64, uint64, error) {
	counters, err := net.IOCounters(false)
	if err != nil || len(counters) == 0 {
		return 0, 0, err
	}
	return counters[0].BytesRecv, counters[0].BytesSent, nil
}

// totalDiskIO sums read/write byte, count, and time-spent counters across every disk,
// mirroring how totalNetBytes aggregates every interface into one figure - the dashboard
// wants "how busy is this server's storage overall", not a per-disk breakdown.
func totalDiskIO() (readBytes, writeBytes, readCount, writeCount, readTimeMs, writeTimeMs uint64, err error) {
	counters, err := disk.IOCounters()
	if err != nil {
		return 0, 0, 0, 0, 0, 0, err
	}
	for _, c := range counters {
		readBytes += c.ReadBytes
		writeBytes += c.WriteBytes
		readCount += c.ReadCount
		writeCount += c.WriteCount
		readTimeMs += c.ReadTime
		writeTimeMs += c.WriteTime
	}
	return readBytes, writeBytes, readCount, writeCount, readTimeMs, writeTimeMs, nil
}

type rateSample struct {
	netRxMbps, netTxMbps        float64
	diskReadMBps, diskWriteMBps float64
	diskIops, diskLatencyMs     float64
}

// measureRates samples cumulative network and disk I/O counters twice, one second apart,
// in a single shared window - gopsutil only exposes running totals, never an instantaneous
// rate, and sampling network and disk together halves the time this takes versus two
// separate 1-second measurements.
func measureRates() rateSample {
	var out rateSample

	rx0, tx0, netErr := totalNetBytes()
	drb0, dwb0, drc0, dwc0, drt0, dwt0, diskErr := totalDiskIO()

	time.Sleep(1 * time.Second)

	if netErr == nil {
		if rx1, tx1, err := totalNetBytes(); err == nil && rx1 >= rx0 && tx1 >= tx0 {
			out.netRxMbps = float64(rx1-rx0) * 8 / 1_000_000
			out.netTxMbps = float64(tx1-tx0) * 8 / 1_000_000
		}
		// counters reset (e.g. interface reconnect) — leave at zero rather than wrap
	}

	if diskErr == nil {
		drb1, dwb1, drc1, dwc1, drt1, dwt1, err := totalDiskIO()
		if err == nil && drb1 >= drb0 && dwb1 >= dwb0 && drc1 >= drc0 && dwc1 >= dwc0 {
			out.diskReadMBps = float64(drb1-drb0) / (1024 * 1024)
			out.diskWriteMBps = float64(dwb1-dwb0) / (1024 * 1024)
			ioCount := (drc1 - drc0) + (dwc1 - dwc0)
			out.diskIops = float64(ioCount)
			if ioCount > 0 {
				out.diskLatencyMs = float64((drt1-drt0)+(dwt1-dwt0)) / float64(ioCount)
			}
		}
	}

	return out
}
