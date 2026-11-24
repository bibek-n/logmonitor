package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	gopsnet "github.com/shirou/gopsutil/v3/net"
)

// Live per-adapter bandwidth for the dashboard's "Live Bandwidth (Employees)" page.
//
// Every bandwidthSampleInterval the agent reads the cumulative byte counters of each real network
// adapter (gopsutil: GetIfTable2 on Windows, /proc/net/dev on Linux, sysctl on macOS - all cheap,
// no packet capture) and turns the delta into Mbps. Every bandwidthReportInterval the samples
// gathered since the last report go to /api/agent/bandwidth in one request. Totals per adapter
// only - nothing per process or per site.
//
// Runs on its own goroutine (started from Run), independent of the heartbeat and the collection
// worker, so it neither waits on them nor can delay them.

const (
	bandwidthSampleInterval = 5 * time.Second
	bandwidthReportInterval = 10 * time.Second
	// Samples kept while the server is unreachable: ~5 minutes of 5-second samples for 3 adapters.
	// Oldest are dropped first; a longer outage just leaves a gap in the 1-hour raw history.
	bandwidthBufferMax = 180
	// `query user` is a process spawn - re-checking the logged-in user once a minute is plenty.
	bandwidthUserRefresh = time.Minute
)

type BandwidthSample struct {
	Adapter      string  `json:"adapter"`
	AdapterType  string  `json:"adapterType"` // wifi | ethernet | other
	RxMbps       float64 `json:"rxMbps"`
	TxMbps       float64 `json:"txMbps"`
	RxBytes      uint64  `json:"rxBytes"` // bytes received during this sample's interval
	TxBytes      uint64  `json:"txBytes"`
	RxBytesTotal uint64  `json:"rxBytesTotal"` // the adapter's cumulative counters
	TxBytesTotal uint64  `json:"txBytesTotal"`
	IntervalSec  float64 `json:"intervalSec"`
	Timestamp    int64   `json:"ts"` // unix ms, agent clock
}

type BandwidthReport struct {
	Hostname    string            `json:"hostname"`
	CurrentUser string            `json:"currentUser"`
	SentAt      int64             `json:"sentAt"` // unix ms, agent clock - lets the server correct clock skew
	Samples     []BandwidthSample `json:"samples"`
}

// errBandwidthRejected marks a report the server refused as invalid: resending the same batch can
// never succeed, so the caller drops it instead of re-queuing.
var errBandwidthRejected = errors.New("bandwidth report rejected as invalid")

// PostBandwidth sends one report. Unlike postJSON it reads the reply: this endpoint (like the
// heartbeat) answers HTTP 200 even on failure, with {"ok":false}, because IIS would replace a
// non-2xx body with its own HTML page. Without reading it, "not stored" would look like success
// and the samples would be lost instead of retried.
func (c *Client) PostBandwidth(r BandwidthReport) error {
	body, err := json.Marshal(r)
	if err != nil {
		return err
	}
	req, err := c.authRequest("POST", "/api/agent/bandwidth", bytes.NewReader(body), "application/json")
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("POST /api/agent/bandwidth failed: HTTP %d", resp.StatusCode)
	}
	var out struct {
		Ok    bool   `json:"ok"`
		Error string `json:"error"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64*1024)).Decode(&out); err != nil {
		return fmt.Errorf("bandwidth: unreadable server reply: %w", err)
	}
	if !out.Ok {
		if strings.Contains(strings.ToLower(out.Error), "invalid") {
			return errBandwidthRejected
		}
		return fmt.Errorf("bandwidth: server did not store the report: %s", out.Error)
	}
	return nil
}

// ---------------------------------------------------------------- adapter selection (pure)

// Names of adapters that are not a physical link of their own: hypervisor/container bridges,
// tunnels and Windows pseudo-adapters. Counted only if they carry the route to the server (a
// VPN in use, for example), since then that IS the traffic path.
var virtualAdapterRe = regexp.MustCompile(`(?i)(vethernet|hyper-v|vmware|vmnet|virtualbox|vbox|docker|^br-|^veth|virbr|^lo$|loopback|isatap|teredo|6to4|pseudo|bluetooth|local area connection\*|wi-fi direct|^utun|^awdl|^llw|^bridge|^gif|^stf|^anpi|^ap\d|npcap|wan miniport|kernel debug|^tailscale|^zt|^wg|^tun|^tap)`)

var wifiAdapterRe = regexp.MustCompile(`(?i)(wi-?fi|wlan|wireless|802\.11|^wl)`)
var ethernetAdapterRe = regexp.MustCompile(`(?i)(ethernet|^eth|^en[opsx]|^eno|^enp|^ens|^em\d|local area connection)`)

// adapterType classifies by name. macOS names (en0/en1) don't say which is Wi-Fi, so darwin
// passes in what networksetup reported (hardwarePorts); elsewhere the OS's own names are telling
// enough (Windows "Wi-Fi"/"Ethernet", Linux wl*/en*/eth*).
func adapterType(name string, hardwarePorts map[string]string) string {
	if port, ok := hardwarePorts[name]; ok {
		switch {
		case wifiAdapterRe.MatchString(port):
			return "wifi"
		case ethernetAdapterRe.MatchString(port), strings.Contains(strings.ToLower(port), "thunderbolt"), strings.Contains(strings.ToLower(port), "usb"):
			return "ethernet"
		}
	}
	switch {
	case wifiAdapterRe.MatchString(name):
		return "wifi"
	case ethernetAdapterRe.MatchString(name):
		return "ethernet"
	}
	return "other"
}

type adapterInfo struct {
	name   string
	up     bool
	hasIP  bool
	routed bool // carries the route this agent uses to reach the server
}

// selectAdapters returns the adapter names to sample: up physical adapters with an IP address,
// plus whichever adapter carries the route to the server even if it looks virtual.
func selectAdapters(adapters []adapterInfo) map[string]bool {
	out := map[string]bool{}
	for _, a := range adapters {
		if a.routed {
			out[a.name] = true
			continue
		}
		if !a.up || !a.hasIP || virtualAdapterRe.MatchString(a.name) {
			continue
		}
		out[a.name] = true
	}
	return out
}

// ---------------------------------------------------------------- rate maths (pure)

type counterReading struct {
	rx, tx uint64
	at     time.Time
}

// counterDelta handles a counter that went backwards (adapter reset, driver reload, 32-bit
// wrap): the new value is then the best estimate of the bytes since the reset.
func counterDelta(prev, cur uint64) uint64 {
	if cur >= prev {
		return cur - prev
	}
	return cur
}

func makeSample(name, kind string, prev, cur counterReading) (BandwidthSample, bool) {
	secs := cur.at.Sub(prev.at).Seconds()
	if secs <= 0.5 { // too close to the previous read to give a meaningful rate
		return BandwidthSample{}, false
	}
	rx := counterDelta(prev.rx, cur.rx)
	tx := counterDelta(prev.tx, cur.tx)
	mbps := func(b uint64) float64 { return float64(b) * 8 / secs / 1e6 }
	return BandwidthSample{
		Adapter: name, AdapterType: kind,
		RxMbps: round3(mbps(rx)), TxMbps: round3(mbps(tx)),
		RxBytes: rx, TxBytes: tx, RxBytesTotal: cur.rx, TxBytesTotal: cur.tx,
		IntervalSec: round3(secs), Timestamp: cur.at.UnixMilli(),
	}, true
}

func round3(f float64) float64 { return float64(int64(f*1000+0.5)) / 1000 }

// ---------------------------------------------------------------- buffer (pure)

type sampleBuffer struct {
	mu      sync.Mutex
	samples []BandwidthSample
	max     int
}

func (b *sampleBuffer) add(s ...BandwidthSample) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.samples = append(b.samples, s...)
	if over := len(b.samples) - b.max; over > 0 {
		b.samples = append([]BandwidthSample(nil), b.samples[over:]...) // drop oldest
	}
}

// take removes and returns everything buffered; requeue puts a failed batch back in front.
func (b *sampleBuffer) take() []BandwidthSample {
	b.mu.Lock()
	defer b.mu.Unlock()
	out := b.samples
	b.samples = nil
	return out
}

func (b *sampleBuffer) requeue(batch []BandwidthSample) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.samples = append(append([]BandwidthSample(nil), batch...), b.samples...)
	if over := len(b.samples) - b.max; over > 0 {
		b.samples = b.samples[over:]
	}
}

// ---------------------------------------------------------------- OS glue

// routedAdapterName finds the adapter the OS would use to reach the server. Dialing UDP sends no
// packet - it only asks the routing table which local address would be used.
func routedAdapterName(serverURL string) string {
	u, err := url.Parse(serverURL)
	if err != nil || u.Hostname() == "" {
		return ""
	}
	port := u.Port()
	if port == "" {
		port = "443"
	}
	conn, err := net.DialTimeout("udp", net.JoinHostPort(u.Hostname(), port), 3*time.Second)
	if err != nil {
		return ""
	}
	defer conn.Close()
	local, ok := conn.LocalAddr().(*net.UDPAddr)
	if !ok {
		return ""
	}
	ifaces, _ := net.Interfaces()
	for _, iface := range ifaces {
		addrs, _ := iface.Addrs()
		for _, a := range addrs {
			if ipn, ok := a.(*net.IPNet); ok && ipn.IP.Equal(local.IP) {
				return iface.Name
			}
		}
	}
	return ""
}

func currentAdapters(routed string) []adapterInfo {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	out := make([]adapterInfo, 0, len(ifaces))
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		hasIP := false
		if addrs, err := iface.Addrs(); err == nil {
			for _, a := range addrs {
				if ipn, ok := a.(*net.IPNet); ok && !ipn.IP.IsLinkLocalUnicast() && !ipn.IP.IsLoopback() {
					hasIP = true
					break
				}
			}
		}
		out = append(out, adapterInfo{name: iface.Name, up: iface.Flags&net.FlagUp != 0, hasIP: hasIP, routed: iface.Name == routed})
	}
	return out
}

// macOS: map device (en0) -> hardware port ("Wi-Fi", "Ethernet", "Thunderbolt Ethernet").
func darwinHardwarePorts() map[string]string {
	ports := map[string]string{}
	if runtime.GOOS != "darwin" {
		return ports
	}
	out := runOut("networksetup", "-listallhardwareports")
	var port string
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "Hardware Port:") {
			port = strings.TrimSpace(strings.TrimPrefix(line, "Hardware Port:"))
		} else if strings.HasPrefix(line, "Device:") && port != "" {
			ports[strings.TrimSpace(strings.TrimPrefix(line, "Device:"))] = port
		}
	}
	return ports
}

// runBandwidthMonitor samples and reports until stop closes.
func runBandwidthMonitor(client *Client, hostname string, stop <-chan struct{}) {
	buf := &sampleBuffer{max: bandwidthBufferMax}
	prev := map[string]counterReading{}
	ports := darwinHardwarePorts()

	var selected map[string]bool
	var lastSelect time.Time
	var user string
	var lastUser time.Time

	sampleTick := time.NewTicker(bandwidthSampleInterval)
	reportTick := time.NewTicker(bandwidthReportInterval)
	defer sampleTick.Stop()
	defer reportTick.Stop()

	for {
		select {
		case <-stop:
			return
		case <-sampleTick.C:
			// Adapters come and go (Wi-Fi <-> Ethernet, VPN up/down, network switch) - re-select
			// once a minute rather than every 5 seconds.
			if selected == nil || time.Since(lastSelect) > time.Minute {
				selected = selectAdapters(currentAdapters(routedAdapterName(client.ServerURL)))
				lastSelect = time.Now()
			}
			counters, err := gopsnet.IOCounters(true)
			if err != nil {
				continue
			}
			now := time.Now()
			seen := map[string]bool{}
			for _, c := range counters {
				if !selected[c.Name] {
					continue
				}
				seen[c.Name] = true
				cur := counterReading{rx: c.BytesRecv, tx: c.BytesSent, at: now}
				if p, ok := prev[c.Name]; ok {
					if s, ok := makeSample(c.Name, adapterType(c.Name, ports), p, cur); ok {
						buf.add(s)
					}
				}
				prev[c.Name] = cur
			}
			for name := range prev {
				if !seen[name] {
					delete(prev, name) // adapter gone - restart its delta cleanly if it comes back
				}
			}
		case <-reportTick.C:
			batch := buf.take()
			if len(batch) == 0 {
				continue
			}
			if user == "" || time.Since(lastUser) > bandwidthUserRefresh {
				user = CurrentLoggedInUser()
				lastUser = time.Now()
			}
			err := client.PostBandwidth(BandwidthReport{Hostname: hostname, CurrentUser: user, SentAt: time.Now().UnixMilli(), Samples: batch})
			switch {
			case err == nil:
			case errors.Is(err, errBandwidthRejected):
				log.Printf("bandwidth report rejected by the server as invalid - dropped %d samples", len(batch))
			default:
				buf.requeue(batch)
				log.Printf("bandwidth report failed (kept %d samples for retry): %v", len(batch), err)
			}
		}
	}
}
