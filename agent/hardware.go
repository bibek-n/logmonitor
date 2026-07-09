package main

import (
	"os/exec"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

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
	DiskModel       string  `json:"diskModel"`
	DiskType        string  `json:"diskType"` // "ssd" | "hdd" | "unknown"
	DiskCapacityGB  float64 `json:"diskCapacityGB"`
	GpuName         string  `json:"gpuName"`
	OsEdition       string  `json:"osEdition"`
	OsBuild         string  `json:"osBuild"`
	KernelVersion   string  `json:"kernelVersion"`
	Architecture    string  `json:"architecture"`
}

func runOut(name string, args ...string) string {
	out, err := exec.Command(name, args...).Output()
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

	return hw
}

var diskSizeRe = regexp.MustCompile(`(\d+)`)

func collectDiskInfo(hw *HardwareInfo) {
	if runtime.GOOS == "windows" {
		out := runOut("powershell", "-NoProfile", "-Command",
			"Get-CimInstance -ClassName Win32_DiskDrive | Select-Object -First 1 -Property Model,MediaType,Size | Format-List")
		if out == "" {
			return
		}
		for _, line := range strings.Split(out, "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "Model") {
				hw.DiskModel = strings.TrimSpace(strings.SplitN(line, ":", 2)[1])
			} else if strings.HasPrefix(line, "MediaType") {
				mt := strings.ToLower(line)
				if strings.Contains(mt, "ssd") {
					hw.DiskType = "ssd"
				} else if strings.Contains(mt, "fixed") || strings.Contains(mt, "hdd") {
					hw.DiskType = "hdd"
				} else {
					hw.DiskType = "unknown"
				}
			} else if strings.HasPrefix(line, "Size") {
				if m := diskSizeRe.FindString(line); m != "" {
					if bytes, err := strconv.ParseFloat(m, 64); err == nil {
						hw.DiskCapacityGB = bytes / (1024 * 1024 * 1024)
					}
				}
			}
		}
		return
	}

	// Linux: best-effort, first non-loop/ram block device under /sys/block.
	entries := runOut("sh", "-c", "ls /sys/block 2>/dev/null | grep -Ev '^(loop|ram)' | head -1")
	dev := strings.TrimSpace(entries)
	if dev == "" {
		return
	}
	rotational := runOut("cat", "/sys/block/"+dev+"/queue/rotational")
	switch rotational {
	case "0":
		hw.DiskType = "ssd"
	case "1":
		hw.DiskType = "hdd"
	default:
		hw.DiskType = "unknown"
	}
	hw.DiskModel = runOut("cat", "/sys/block/"+dev+"/device/model")
	if sizeSectors := runOut("cat", "/sys/block/"+dev+"/size"); sizeSectors != "" {
		if sectors, err := strconv.ParseFloat(sizeSectors, 64); err == nil {
			hw.DiskCapacityGB = (sectors * 512) / (1024 * 1024 * 1024)
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
