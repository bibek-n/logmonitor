package main

import (
	"context"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

// DiskInfo describes one physical disk — CollectHardwareInfo now enumerates all disks
// (not just the first) for the Servers feature's multi-disk inventory.
type DiskInfo struct {
	Index              int      `json:"index"`
	Model              string   `json:"model"`
	Type               string   `json:"type"` // "ssd" | "hdd" | "unknown"
	CapacityGB         float64  `json:"capacityGB"`
	HealthStatus       string   `json:"healthStatus"`      // "Healthy" | "Warning" | "Unhealthy" | "" (unknown/unsupported)
	OperationalStatus  string   `json:"operationalStatus"` // e.g. "OK", "Predict Failure" - Storage subsystem's own wording
	TemperatureCelsius *float64 `json:"temperatureCelsius,omitempty"`
}

// HardwareInfo is mostly static (collected once at start and re-sent daily) — every
// field is best-effort. A missing sensor/tool (e.g. no lspci on a minimal Linux image)
// yields an empty value, never an error, since this is genuinely unavailable on plenty
// of real hardware.
type HardwareInfo struct {
	CpuModel        string  `json:"cpuModel"`
	CpuManufacturer string  `json:"cpuManufacturer"`
	CpuCores        int     `json:"cpuCores"`
	CpuThreads      int     `json:"cpuThreads"`
	CpuClockMhz     float64 `json:"cpuClockMhz"`
	MemoryTotalMB   int64   `json:"memoryTotalMB"`
	// Primary disk kept for backward compatibility with DeviceHardwareInfo's single-disk
	// columns — always mirrors Disks[0] when present.
	DiskModel       string  `json:"diskModel"`
	DiskType        string  `json:"diskType"`
	DiskCapacityGB  float64 `json:"diskCapacityGB"`
	Disks           []DiskInfo             `json:"disks"`
	Interfaces      []NetworkInterfaceInfo `json:"interfaces"`
	GpuName         string  `json:"gpuName"`
	OsEdition       string  `json:"osEdition"`
	OsBuild         string  `json:"osBuild"`
	KernelVersion   string  `json:"kernelVersion"`
	Architecture    string  `json:"architecture"`

	// Server-oriented deep identity fields (Servers feature) — best-effort, empty when
	// the platform/permissions don't expose them.
	MotherboardManufacturer string `json:"motherboardManufacturer"`
	MotherboardModel        string `json:"motherboardModel"`
	MotherboardSerial       string `json:"motherboardSerial"`
	BiosManufacturer        string `json:"biosManufacturer"`
	BiosVersion             string `json:"biosVersion"`
	BiosReleaseDate         string `json:"biosReleaseDate"`
	SystemManufacturer      string `json:"systemManufacturer"`
	SystemModel             string `json:"systemModel"`
	SerialNumber            string `json:"serialNumber"`
}

// Every subprocess this file spawns gets a hard timeout - confirmed live that a PowerShell
// child process can hang indefinitely when spawned from inside a Windows Service (no console
// session), even for calls that return instantly when run interactively during development.
// Since CollectHardwareInfo() runs synchronously on the heartbeat tick, one hung child process
// used to freeze the agent's entire main loop forever, not just leave one field blank.
const subprocessTimeout = 10 * time.Second

func runOut(name string, args ...string) string {
	ctx, cancel := context.WithTimeout(context.Background(), subprocessTimeout)
	defer cancel()
	out, err := exec.CommandContext(ctx, name, args...).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func CollectHardwareInfo() HardwareInfo {
	var hw HardwareInfo

	if infos, err := cpu.Info(); err == nil && len(infos) > 0 {
		hw.CpuModel = infos[0].ModelName
		hw.CpuManufacturer = infos[0].VendorID
		hw.CpuClockMhz = infos[0].Mhz
	}
	if physical, err := cpu.Counts(false); err == nil {
		hw.CpuCores = physical
	}
	if logical, err := cpu.Counts(true); err == nil {
		hw.CpuThreads = logical
	}

	if vm, err := mem.VirtualMemory(); err == nil {
		hw.MemoryTotalMB = int64(vm.Total / (1024 * 1024))
	}

	if info, err := host.Info(); err == nil {
		hw.OsBuild = info.PlatformVersion
		hw.KernelVersion = info.KernelVersion
		hw.Architecture = info.KernelArch
	}
	hw.Architecture = runtime.GOARCH

	collectDiskInfo(&hw)
	collectGpuInfo(&hw)
	collectOsEdition(&hw)
	collectSystemIdentity(&hw)
	hw.Interfaces = CollectAllInterfaces()

	return hw
}

func collectDiskInfo(hw *HardwareInfo) {
	if runtime.GOOS == "windows" {
		// Format-Table-free CSV-ish output, one physical disk per block separated by a marker,
		// so multiple disks can be parsed without ambiguity.
		out := runOut("powershell", "-NoProfile", "-Command",
			"Get-CimInstance -ClassName Win32_DiskDrive | ForEach-Object { \"$($_.Index)|$($_.Model)|$($_.MediaType)|$($_.Size)\" }")
		if out == "" {
			return
		}
		for _, line := range strings.Split(out, "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			parts := strings.SplitN(line, "|", 4)
			if len(parts) != 4 {
				continue
			}
			idx, _ := strconv.Atoi(strings.TrimSpace(parts[0]))
			disk := DiskInfo{Index: idx, Model: strings.TrimSpace(parts[1])}
			mt := strings.ToLower(parts[2])
			switch {
			case strings.Contains(mt, "ssd"):
				disk.Type = "ssd"
			case strings.Contains(mt, "fixed") || strings.Contains(mt, "hdd"):
				disk.Type = "hdd"
			default:
				disk.Type = "unknown"
			}
			if bytes, err := strconv.ParseFloat(strings.TrimSpace(parts[3]), 64); err == nil {
				disk.CapacityGB = bytes / (1024 * 1024 * 1024)
			}
			hw.Disks = append(hw.Disks, disk)
		}
		applyWindowsDiskHealth(hw.Disks)
	} else {
		// Linux: enumerate every non-loop/ram block device under /sys/block.
		entries := runOut("sh", "-c", "ls /sys/block 2>/dev/null | grep -Ev '^(loop|ram)'")
		if entries == "" {
			return
		}
		for i, dev := range strings.Fields(entries) {
			disk := DiskInfo{Index: i}
			rotational := runOut("cat", "/sys/block/"+dev+"/queue/rotational")
			switch rotational {
			case "0":
				disk.Type = "ssd"
			case "1":
				disk.Type = "hdd"
			default:
				disk.Type = "unknown"
			}
			disk.Model = runOut("cat", "/sys/block/"+dev+"/device/model")
			if sizeSectors := runOut("cat", "/sys/block/"+dev+"/size"); sizeSectors != "" {
				if sectors, err := strconv.ParseFloat(sizeSectors, 64); err == nil {
					disk.CapacityGB = (sectors * 512) / (1024 * 1024 * 1024)
				}
			}
			hw.Disks = append(hw.Disks, disk)
		}
	}

	if len(hw.Disks) > 0 {
		hw.DiskModel = hw.Disks[0].Model
		hw.DiskType = hw.Disks[0].Type
		hw.DiskCapacityGB = hw.Disks[0].CapacityGB
	}
}

// applyWindowsDiskHealth fills in HealthStatus/OperationalStatus/TemperatureCelsius using the
// modern Windows Storage Management API (Get-PhysicalDisk / Get-StorageReliabilityCounter) -
// this surfaces the same underlying SMART/predictive-failure data as raw ATA SMART commands
// without needing a third-party library or elevated raw-disk access, and works across the
// full range of controllers (SATA, NVMe, RAID) that a hand-rolled SMART reader would miss.
// Best-effort: matched to hw.Disks by index (Get-PhysicalDisk's DeviceId is the physical
// drive number, matching Win32_DiskDrive's Index for the same disk in normal setups); any
// disk this can't match or that errors out is simply left with empty health fields.
func applyWindowsDiskHealth(disks []DiskInfo) {
	out := runOut("powershell", "-NoProfile", "-Command",
		`Get-PhysicalDisk | ForEach-Object { $pd = $_; $temp = $null; try { $temp = (Get-StorageReliabilityCounter -PhysicalDisk $pd -ErrorAction Stop).Temperature } catch {}; $op = ($pd.OperationalStatus -join ';'); "$($pd.DeviceId)|$($pd.HealthStatus)|$op|$temp" }`)
	if out == "" {
		return
	}
	byIndex := make(map[int]DiskInfo)
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "|", 4)
		if len(parts) != 4 {
			continue
		}
		idx, err := strconv.Atoi(strings.TrimSpace(parts[0]))
		if err != nil {
			continue
		}
		info := DiskInfo{HealthStatus: strings.TrimSpace(parts[1]), OperationalStatus: strings.TrimSpace(parts[2])}
		if tempStr := strings.TrimSpace(parts[3]); tempStr != "" {
			if temp, err := strconv.ParseFloat(tempStr, 64); err == nil {
				info.TemperatureCelsius = &temp
			}
		}
		byIndex[idx] = info
	}
	for i := range disks {
		if info, ok := byIndex[disks[i].Index]; ok {
			disks[i].HealthStatus = info.HealthStatus
			disks[i].OperationalStatus = info.OperationalStatus
			disks[i].TemperatureCelsius = info.TemperatureCelsius
		}
	}
}

func collectGpuInfo(hw *HardwareInfo) {
	if runtime.GOOS == "windows" {
		hw.GpuName = runOut("powershell", "-NoProfile", "-Command",
			"(Get-CimInstance -ClassName Win32_VideoController | Select-Object -First 1 -ExpandProperty Name)")
		return
	}
	if _, err := exec.LookPath("lspci"); err != nil {
		return
	}
	out := runOut("sh", "-c", "lspci | grep -i 'vga\\|3d controller' | head -1")
	if idx := strings.Index(out, ": "); idx >= 0 {
		hw.GpuName = strings.TrimSpace(out[idx+2:])
	}
}

func collectOsEdition(hw *HardwareInfo) {
	if runtime.GOOS == "windows" {
		hw.OsEdition = runOut("powershell", "-NoProfile", "-Command",
			"(Get-CimInstance -ClassName Win32_OperatingSystem).Caption")
		return
	}
	out := runOut("sh", "-c", ". /etc/os-release 2>/dev/null; echo \"$PRETTY_NAME\"")
	hw.OsEdition = out
}

// collectSystemIdentity fills in motherboard/BIOS/serial-number fields — new for the
// Servers feature (Devices.SerialNumber/MotherboardSerial/BiosVersion existed since
// Phase 2 but were never actually populated by any agent code until now).
func collectSystemIdentity(hw *HardwareInfo) {
	if runtime.GOOS == "windows" {
		hw.MotherboardManufacturer = runOut("powershell", "-NoProfile", "-Command",
			"(Get-CimInstance -ClassName Win32_BaseBoard).Manufacturer")
		hw.MotherboardModel = runOut("powershell", "-NoProfile", "-Command",
			"(Get-CimInstance -ClassName Win32_BaseBoard).Product")
		hw.MotherboardSerial = runOut("powershell", "-NoProfile", "-Command",
			"(Get-CimInstance -ClassName Win32_BaseBoard).SerialNumber")
		hw.BiosManufacturer = runOut("powershell", "-NoProfile", "-Command",
			"(Get-CimInstance -ClassName Win32_BIOS).Manufacturer")
		hw.BiosVersion = runOut("powershell", "-NoProfile", "-Command",
			"(Get-CimInstance -ClassName Win32_BIOS).SMBIOSBIOSVersion")
		if raw := runOut("powershell", "-NoProfile", "-Command",
			"(Get-CimInstance -ClassName Win32_BIOS).ReleaseDate"); raw != "" {
			hw.BiosReleaseDate = raw
		}
		hw.SystemManufacturer = runOut("powershell", "-NoProfile", "-Command",
			"(Get-CimInstance -ClassName Win32_ComputerSystem).Manufacturer")
		hw.SystemModel = runOut("powershell", "-NoProfile", "-Command",
			"(Get-CimInstance -ClassName Win32_ComputerSystem).Model")
		// BIOS serial is the standard, reliable cross-vendor serial number; product UUID
		// is a fallback when BIOS serial is blank (common on VMs / some OEM images).
		if serial := runOut("powershell", "-NoProfile", "-Command",
			"(Get-CimInstance -ClassName Win32_BIOS).SerialNumber"); serial != "" && !strings.EqualFold(serial, "To be filled by O.E.M.") {
			hw.SerialNumber = serial
		} else {
			hw.SerialNumber = runOut("powershell", "-NoProfile", "-Command",
				"(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID")
		}
		return
	}

	// Linux: DMI sysfs entries, root or sudo required for some fields (e.g. product_serial)
	// on many distros — best-effort, blank if unreadable.
	hw.MotherboardManufacturer = runOut("cat", "/sys/class/dmi/id/board_vendor")
	hw.MotherboardModel = runOut("cat", "/sys/class/dmi/id/board_name")
	hw.MotherboardSerial = runOut("cat", "/sys/class/dmi/id/board_serial")
	hw.BiosManufacturer = runOut("cat", "/sys/class/dmi/id/bios_vendor")
	hw.BiosVersion = runOut("cat", "/sys/class/dmi/id/bios_version")
	hw.BiosReleaseDate = runOut("cat", "/sys/class/dmi/id/bios_date")
	hw.SystemManufacturer = runOut("cat", "/sys/class/dmi/id/sys_vendor")
	hw.SystemModel = runOut("cat", "/sys/class/dmi/id/product_name")
	hw.SerialNumber = runOut("cat", "/sys/class/dmi/id/product_serial")
	if hw.SerialNumber == "" {
		hw.SerialNumber = runOut("cat", "/sys/class/dmi/id/product_uuid")
	}
}
