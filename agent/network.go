package main

import (
	"net"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	gopsnet "github.com/shirou/gopsutil/v3/net"
)

// NetworkInterfaceInfo describes one network interface — used for the Servers feature's
// multi-NIC inventory (CollectNetworkInfo's CurrentIp/etc. remain the "primary interface"
// summary used by workstation monitoring; this is the fuller per-interface list).
type NetworkInterfaceInfo struct {
	Name        string   `json:"name"`
	MacAddress  string   `json:"macAddress"`
	IpAddresses []string `json:"ipAddresses"`
	IsUp        bool     `json:"isUp"`
	SpeedMbps   int      `json:"speedMbps"`
}

// CollectAllInterfaces enumerates every network interface (not just the primary one),
// best-effort — a speed of 0 means "unknown", not "no link".
func CollectAllInterfaces() []NetworkInterfaceInfo {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}

	var result []NetworkInterfaceInfo
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		info := NetworkInterfaceInfo{
			Name:       iface.Name,
			MacAddress: iface.HardwareAddr.String(),
			IsUp:       iface.Flags&net.FlagUp != 0,
		}
		if addrs, err := iface.Addrs(); err == nil {
			for _, a := range addrs {
				if ipNet, ok := a.(*net.IPNet); ok {
					info.IpAddresses = append(info.IpAddresses, ipNet.IP.String())
				}
			}
		}
		info.SpeedMbps = interfaceSpeedMbps(iface.Name)
		result = append(result, info)
	}
	return result
}

func interfaceSpeedMbps(name string) int {
	if runtime.GOOS == "windows" {
		// Get-NetAdapter requires PowerShell 3.0+ (Windows 8+) - Win32_NetworkAdapter's
		// Speed property (bits/sec) has been available since Windows 2000 and works
		// identically on every supported Windows version.
		nameEscaped := strings.ReplaceAll(name, "'", "''")
		out := runOut("powershell", "-NoProfile", "-Command",
			"(Get-WmiObject -Class Win32_NetworkAdapter -Filter \"NetConnectionID='"+nameEscaped+"'\" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Speed)")
		bps, err := strconv.ParseFloat(strings.TrimSpace(out), 64)
		if err != nil || bps <= 0 {
			return 0
		}
		return int(bps / 1_000_000)
	}
	speed := runOut("cat", "/sys/class/net/"+name+"/speed")
	if v, err := strconv.Atoi(speed); err == nil && v > 0 {
		return v
	}
	return 0
}

type NetworkInfo struct {
	CurrentIp         string `json:"currentIp"`
	PublicIp          string `json:"publicIp"`
	GatewayIp         string `json:"gatewayIp"`
	DnsServers        string `json:"dnsServers"` // comma-separated
	WifiSsid          string `json:"wifiSsid"`
	VpnActive         bool   `json:"vpnActive"`
	EthernetConnected bool   `json:"ethernetConnected"`
	OpenPorts         []int  `json:"openPorts"`
	ListeningPorts    []int  `json:"listeningPorts"`
}

func CollectNetworkInfo() NetworkInfo {
	var n NetworkInfo

	n.CurrentIp = primaryLocalIP()
	n.PublicIp = fetchPublicIP()
	n.GatewayIp = detectGateway()
	n.DnsServers = strings.Join(detectDNSServers(), ",")
	n.WifiSsid = detectWifiSSID()
	n.VpnActive, n.EthernetConnected = detectInterfaceState()

	if conns, err := gopsnet.Connections("inet"); err == nil {
		listenSet := map[int]bool{}
		openSet := map[int]bool{}
		for _, c := range conns {
			if c.Status == "LISTEN" {
				listenSet[int(c.Laddr.Port)] = true
			} else if c.Status == "ESTABLISHED" {
				openSet[int(c.Laddr.Port)] = true
			}
		}
		for p := range listenSet {
			n.ListeningPorts = append(n.ListeningPorts, p)
		}
		for p := range openSet {
			n.OpenPorts = append(n.OpenPorts, p)
		}
	}

	return n
}

func primaryLocalIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return ""
	}
	defer conn.Close()
	addr, ok := conn.LocalAddr().(*net.UDPAddr)
	if !ok {
		return ""
	}
	return addr.IP.String()
}

func fetchPublicIP() string {
	client := http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("https://api.ipify.org")
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	buf := make([]byte, 64)
	nRead, _ := resp.Body.Read(buf)
	ip := strings.TrimSpace(string(buf[:nRead]))
	if net.ParseIP(ip) == nil {
		return ""
	}
	return ip
}

func detectGateway() string {
	if runtime.GOOS == "windows" {
		// Get-NetRoute requires PowerShell 3.0+ (Windows 8+) - Win32_NetworkAdapterConfiguration's
		// DefaultIPGateway has been available since Windows 2000.
		out := runOut("powershell", "-NoProfile", "-Command",
			"(Get-WmiObject -Class Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=True' -ErrorAction SilentlyContinue | Where-Object {$_.DefaultIPGateway} | Select-Object -First 1 -ExpandProperty DefaultIPGateway) | Select-Object -First 1")
		return strings.TrimSpace(out)
	}
	out := runOut("sh", "-c", "ip route show default 2>/dev/null | awk '/default/ {print $3; exit}'")
	return strings.TrimSpace(out)
}

func detectDNSServers() []string {
	if runtime.GOOS == "windows" {
		// Get-DnsClientServerAddress requires PowerShell 3.0+ (Windows 8+) -
		// Win32_NetworkAdapterConfiguration's DNSServerSearchOrder has been available since
		// Windows 2000.
		out := runOut("powershell", "-NoProfile", "-Command",
			"(Get-WmiObject -Class Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=True' -ErrorAction SilentlyContinue | Where-Object {$_.DNSServerSearchOrder} | Select-Object -First 1 -ExpandProperty DNSServerSearchOrder) -join ','")
		if out == "" {
			return nil
		}
		return strings.Split(out, ",")
	}
	data, err := os.ReadFile("/etc/resolv.conf")
	if err != nil {
		return nil
	}
	var servers []string
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 && fields[0] == "nameserver" {
			servers = append(servers, fields[1])
		}
	}
	return servers
}

func detectWifiSSID() string {
	if runtime.GOOS == "windows" {
		out := runOut("netsh", "wlan", "show", "interfaces")
		for _, line := range strings.Split(out, "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "SSID") && !strings.HasPrefix(line, "BSSID") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					return strings.TrimSpace(parts[1])
				}
			}
		}
		return ""
	}
	if ssid := runOut("iwgetid", "-r"); ssid != "" {
		return ssid
	}
	out := runOut("sh", "-c", "nmcli -t -f active,ssid dev wifi 2>/dev/null | grep '^yes' | head -1 | cut -d: -f2")
	return strings.TrimSpace(out)
}

// PrimaryMacAddress returns the hardware address of the first up, non-loopback
// interface with one — used at enrollment so the server can cross-reference this
// device against MAC addresses already seen by the MikroTik/Sophos pollers (see
// src/lib/deviceMatch.ts), letting an admin match a newly-enrolled agent to a known
// employee PC / staff record.
func PrimaryMacAddress() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return ""
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		if len(iface.HardwareAddr) == 0 {
			continue
		}
		return iface.HardwareAddr.String()
	}
	return ""
}

var vpnInterfacePrefixes = []string{"tun", "tap", "wg", "ppp", "vpn", "utun"}

// detectInterfaceState is a heuristic, not a guarantee — it flags common VPN adapter
// naming conventions, which covers most VPN clients (OpenVPN/WireGuard/most commercial
// VPN apps) but isn't exhaustive.
func detectInterfaceState() (vpnActive bool, ethernetConnected bool) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return false, false
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		lower := strings.ToLower(iface.Name)
		for _, prefix := range vpnInterfacePrefixes {
			if strings.HasPrefix(lower, prefix) {
				vpnActive = true
			}
		}
		if strings.Contains(lower, "eth") || strings.Contains(lower, "enp") || strings.Contains(lower, "ethernet") {
			ethernetConnected = true
		}
	}
	return vpnActive, ethernetConnected
}
