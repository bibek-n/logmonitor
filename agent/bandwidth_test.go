package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAdapterType(t *testing.T) {
	cases := map[string]string{
		"Wi-Fi": "wifi", "WLAN": "wifi", "wlp2s0": "wifi", "Wireless Network Connection": "wifi",
		"Ethernet": "ethernet", "Ethernet 2": "ethernet", "eth0": "ethernet", "enp1s0": "ethernet", "eno1": "ethernet",
		"Local Area Connection 2": "ethernet", "tun0": "other",
	}
	for name, want := range cases {
		if got := adapterType(name, nil); got != want {
			t.Errorf("adapterType(%q) = %q, want %q", name, got, want)
		}
	}
	// macOS: en0 is ambiguous by name; the hardware-port map decides.
	ports := map[string]string{"en0": "Wi-Fi", "en5": "USB 10/100/1000 LAN"}
	if adapterType("en0", ports) != "wifi" || adapterType("en5", ports) != "ethernet" {
		t.Error("darwin hardware ports not honoured")
	}
}

func TestSelectAdapters(t *testing.T) {
	got := selectAdapters([]adapterInfo{
		{name: "Ethernet", up: true, hasIP: true},
		{name: "Wi-Fi", up: false, hasIP: false},                    // down: skipped
		{name: "vEthernet (Default Switch)", up: true, hasIP: true}, // Hyper-V: skipped
		{name: "VMware Network Adapter VMnet8", up: true, hasIP: true},
		{name: "Local Area Connection* 3", up: true, hasIP: true}, // Wi-Fi Direct pseudo adapter
		{name: "docker0", up: true, hasIP: true},
		{name: "tun0", up: true, hasIP: true, routed: true}, // VPN carrying the route: kept
		{name: "Bluetooth Network Connection", up: true, hasIP: true},
	})
	if len(got) != 2 || !got["Ethernet"] || !got["tun0"] {
		t.Fatalf("unexpected selection: %v", got)
	}
}

func TestMakeSample(t *testing.T) {
	t0 := time.Unix(1000, 0)
	prev := counterReading{rx: 1_000_000, tx: 500_000, at: t0}
	cur := counterReading{rx: 1_000_000 + 6_250_000, tx: 500_000 + 625_000, at: t0.Add(5 * time.Second)}
	s, ok := makeSample("Ethernet", "ethernet", prev, cur)
	if !ok {
		t.Fatal("expected a sample")
	}
	// 6.25 MB in 5 s = 10 Mbps down; 0.625 MB in 5 s = 1 Mbps up
	if s.RxMbps != 10 || s.TxMbps != 1 || s.RxBytes != 6_250_000 || s.TxBytes != 625_000 || s.RxBytesTotal != 7_250_000 {
		t.Fatalf("bad sample: %+v", s)
	}
	// counter reset (e.g. adapter re-enabled): new value is the delta, never a huge wrap-around
	reset, _ := makeSample("Ethernet", "ethernet", prev, counterReading{rx: 4000, tx: 1000, at: t0.Add(5 * time.Second)})
	if reset.RxBytes != 4000 || reset.TxBytes != 1000 {
		t.Fatalf("reset not handled: %+v", reset)
	}
	if _, ok := makeSample("Ethernet", "ethernet", prev, counterReading{rx: 2_000_000, at: t0.Add(100 * time.Millisecond)}); ok {
		t.Fatal("sub-second interval must not produce a sample")
	}
}

func TestSampleBufferBoundedAndRequeue(t *testing.T) {
	b := &sampleBuffer{max: 3}
	for i := 1; i <= 5; i++ {
		b.add(BandwidthSample{Timestamp: int64(i)})
	}
	batch := b.take()
	if len(batch) != 3 || batch[0].Timestamp != 3 || batch[2].Timestamp != 5 {
		t.Fatalf("oldest not dropped: %+v", batch)
	}
	b.add(BandwidthSample{Timestamp: 6})
	b.requeue(batch) // failed send goes back in front, still bounded
	again := b.take()
	if len(again) != 3 || again[0].Timestamp != 4 || again[2].Timestamp != 6 {
		t.Fatalf("requeue order/bound wrong: %+v", again)
	}
}

func TestPostBandwidthReadsServerReply(t *testing.T) {
	reply := ""
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/agent/bandwidth" || r.Header.Get("X-Device-Id") != "dev-1" {
			t.Errorf("unexpected request %s %v", r.URL.Path, r.Header)
		}
		w.WriteHeader(http.StatusOK) // the endpoint always answers 200, like the heartbeat
		_, _ = w.Write([]byte(reply))
	}))
	defer srv.Close()
	c := NewClient(srv.URL, "dev-1", "key")
	report := BandwidthReport{SentAt: 1, Samples: []BandwidthSample{{Adapter: "Ethernet", Timestamp: 1}}}

	reply = `{"ok":true,"stored":1}`
	if err := c.PostBandwidth(report); err != nil {
		t.Fatalf("ok reply: %v", err)
	}
	reply = `{"ok":false,"error":"Invalid bandwidth report"}`
	if err := c.PostBandwidth(report); !errors.Is(err, errBandwidthRejected) {
		t.Fatalf("invalid reply should be errBandwidthRejected (drop), got %v", err)
	}
	reply = `{"ok":false,"error":"Could not store samples"}`
	if err := c.PostBandwidth(report); err == nil || errors.Is(err, errBandwidthRejected) {
		t.Fatalf("not-stored reply must be a retryable error, got %v", err)
	}
}
