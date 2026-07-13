package main

import (
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

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
		}
		out.DiskPct = worst
		out.DiskFreeGB = worstFreeGB
		out.DiskTotalGB = worstTotalGB
	}

	rxMbps, txMbps := measureNetRate()
	out.NetRxMbps = rxMbps
	out.NetTxMbps = txMbps

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

// measureNetRate samples cumulative byte counters twice, one second apart, since
// gopsutil only exposes running totals rather than an instantaneous rate.
func measureNetRate() (rxMbps, txMbps float64) {
	rx0, tx0, err := totalNetBytes()
	if err != nil {
		return 0, 0
	}
	time.Sleep(1 * time.Second)
	rx1, tx1, err := totalNetBytes()
	if err != nil {
		return 0, 0
	}
	if rx1 < rx0 || tx1 < tx0 {
		return 0, 0 // counters reset (e.g. interface reconnect) — skip this sample rather than wrap
	}
	rxMbps = float64(rx1-rx0) * 8 / 1_000_000
	txMbps = float64(tx1-tx0) * 8 / 1_000_000
	return rxMbps, txMbps
}
