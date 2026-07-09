package main

import (
	"net"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	gopsnet "github.com/shirou/gopsutil/v3/net"
)

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
		out := runOut("powershell", "-NoProfile", "-Command",
			"(Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Select-Object -First 1 -ExpandProperty NextHop)")
		return strings.TrimSpace(out)
	}
	out := runOut("sh", "-c", "ip route show default 2>/dev/null | awk '/default/ {print $3; exit}'")
	return strings.TrimSpace(out)
}

func detectDNSServers() []string {
	if runtime.GOOS == "windows" {
		out := runOut("powershell", "-NoProfile", "-Command",
			"(Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object {$_.ServerAddresses.Count -gt 0} | Select-Object -First 1 -ExpandProperty ServerAddresses) -join ','")
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
