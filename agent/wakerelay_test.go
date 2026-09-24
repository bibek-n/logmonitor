package main

import (
	"bytes"
	"net"
	"testing"
)

func TestBuildMagicPacket(t *testing.T) {
	for _, mac := range []string{"aa:bb:cc:dd:ee:ff", "AA-BB-CC-DD-EE-FF", "aabb.ccdd.eeff", "aabbccddeeff"} {
		p, err := buildMagicPacket(mac)
		if err != nil {
			t.Fatalf("%s: %v", mac, err)
		}
		if len(p) != 102 {
			t.Fatalf("%s: len = %d, want 102", mac, len(p))
		}
		if !bytes.Equal(p[:6], bytes.Repeat([]byte{0xFF}, 6)) {
			t.Fatalf("%s: bad sync header", mac)
		}
		want := []byte{0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff}
		for i := 0; i < 16; i++ {
			if !bytes.Equal(p[6+i*6:12+i*6], want) {
				t.Fatalf("%s: repetition %d wrong", mac, i)
			}
		}
	}
}

func TestBuildMagicPacketRejectsBadMac(t *testing.T) {
	for _, mac := range []string{"", "aa:bb:cc", "zz:bb:cc:dd:ee:ff", "aa:bb:cc:dd:ee:ff:00"} {
		if _, err := buildMagicPacket(mac); err == nil {
			t.Errorf("%q: expected error", mac)
		}
	}
}

func TestDirectedBroadcast(t *testing.T) {
	cases := []struct {
		ip, mask, want string
	}{
		{"192.168.10.19", "255.255.255.0", "192.168.10.255"},
		{"10.1.2.3", "255.255.0.0", "10.1.255.255"},
		{"192.168.1.130", "255.255.255.128", "192.168.1.255"},
	}
	for _, c := range cases {
		got := directedBroadcast(net.ParseIP(c.ip), net.IPMask(net.ParseIP(c.mask).To4()))
		if got == nil || got.String() != c.want {
			t.Errorf("%s/%s: got %v, want %s", c.ip, c.mask, got, c.want)
		}
	}
	if directedBroadcast(net.ParseIP("10.0.0.1"), net.CIDRMask(32, 32)) != nil {
		t.Error("/32 should have no broadcast")
	}
	if directedBroadcast(net.ParseIP("::1"), net.CIDRMask(64, 128)) != nil {
		t.Error("IPv6 should have no broadcast")
	}
}
