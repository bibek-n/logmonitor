package main

import (
	"fmt"
	"log"
	"net"
	"strings"
	"time"
)

// Wake-on-LAN relay: the server can't reach devices on other subnets with a broadcast (a
// limited/directed broadcast doesn't cross routers), so for those the server queues a
// PendingWakeRequests row against an online agent that IS on the target's subnet - this
// agent - and this file turns that request into real magic packets on every local network
// it's attached to. Pure net code, no build tags: the same behaviour on Windows/Linux/macOS.

// WakeRequest is one pending relay request from the heartbeat response.
type WakeRequest struct {
	ID  int    `json:"id"`
	Mac string `json:"mac"`
}

const wolPort = 9

// buildMagicPacket returns the standard 102-byte Wake-on-LAN payload: 6x 0xFF followed by
// the target MAC repeated 16 times. Accepts ":" / "-" / "." separated or bare hex MACs.
func buildMagicPacket(mac string) ([]byte, error) {
	cleaned := strings.NewReplacer(":", "", "-", "", ".", "").Replace(strings.TrimSpace(mac))
	if len(cleaned) != 12 {
		return nil, fmt.Errorf("invalid MAC address %q", mac)
	}
	hw, err := net.ParseMAC(fmt.Sprintf("%s:%s:%s:%s:%s:%s", cleaned[0:2], cleaned[2:4], cleaned[4:6], cleaned[6:8], cleaned[8:10], cleaned[10:12]))
	if err != nil {
		return nil, fmt.Errorf("invalid MAC address %q: %w", mac, err)
	}
	packet := make([]byte, 0, 102)
	for i := 0; i < 6; i++ {
		packet = append(packet, 0xFF)
	}
	for i := 0; i < 16; i++ {
		packet = append(packet, hw...)
	}
	return packet, nil
}

// directedBroadcast returns ip | ^mask for an IPv4 address/mask, or nil if it isn't IPv4 or
// the network has no usable broadcast (a /32).
func directedBroadcast(ip net.IP, mask net.IPMask) net.IP {
	v4 := ip.To4()
	if v4 == nil || len(mask) != net.IPv4len {
		return nil
	}
	ones, bits := mask.Size()
	if bits != 32 || ones >= 32 {
		return nil
	}
	out := make(net.IP, net.IPv4len)
	for i := range v4 {
		out[i] = v4[i] | ^mask[i]
	}
	return out
}

type wakeTarget struct {
	local     net.IP
	broadcast net.IP
}

// localWakeTargets lists, for every up, non-loopback interface with an IPv4 address, the
// (local address, directed broadcast) pair to send from. Sending from a specific local
// address pins each packet to the right interface - important on a multi-homed relay (VPN
// adapters, Hyper-V/Docker virtual switches), where an unbound broadcast would only leave
// via whichever interface the OS route table prefers.
func localWakeTargets() []wakeTarget {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	var targets []wakeTarget
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagBroadcast == 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, a := range addrs {
			ipNet, ok := a.(*net.IPNet)
			if !ok {
				continue
			}
			ip4 := ipNet.IP.To4()
			if ip4 == nil || ip4.IsLinkLocalUnicast() {
				continue
			}
			if bc := directedBroadcast(ip4, ipNet.Mask); bc != nil {
				targets = append(targets, wakeTarget{local: ip4, broadcast: bc})
			}
		}
	}
	return targets
}

// sendWake sends the magic packet for mac out of every local network - both to the subnet's
// directed broadcast and to the limited broadcast 255.255.255.255 - a few times, since UDP
// broadcasts are best-effort and a NIC in a deep sleep state can miss a single frame.
// Returns how many (interface, destination) sends succeeded.
func sendWake(mac string) (int, error) {
	packet, err := buildMagicPacket(mac)
	if err != nil {
		return 0, err
	}
	targets := localWakeTargets()
	if len(targets) == 0 {
		return 0, fmt.Errorf("no usable IPv4 network interface to send from")
	}

	sent := 0
	for round := 0; round < 3; round++ {
		if round > 0 {
			time.Sleep(200 * time.Millisecond)
		}
		for _, t := range targets {
			for _, dst := range []net.IP{t.broadcast, net.IPv4bcast} {
				conn, err := net.DialUDP("udp4", &net.UDPAddr{IP: t.local}, &net.UDPAddr{IP: dst, Port: wolPort})
				if err != nil {
					continue
				}
				if _, err := conn.Write(packet); err == nil && round == 0 {
					sent++
				}
				conn.Close()
			}
		}
	}
	if sent == 0 {
		return 0, fmt.Errorf("failed to send on any interface")
	}
	return sent, nil
}

// handlePendingWakeRequests sends each request's magic packet, then acks the ids that were
// actually sent. Execute-then-ack (at-least-once), the opposite order from reboot/shutdown in
// run.go: re-sending a magic packet if an ack is lost is harmless (waking an already-awake
// machine is a no-op), whereas dropping a wake request because the ack "succeeded" before the
// send did would silently lose it.
func handlePendingWakeRequests(client *Client, requests []WakeRequest) {
	var done []int
	for _, req := range requests {
		n, err := sendWake(req.Mac)
		if err != nil {
			log.Printf("wake relay request %d (%s) failed: %v", req.ID, req.Mac, err)
			continue
		}
		log.Printf("wake relay: sent magic packet for %s on %d network(s)", req.Mac, n)
		done = append(done, req.ID)
	}
	if len(done) == 0 {
		return
	}
	if err := client.AckWakeRequests(done); err != nil {
		log.Printf("wake relay ack failed, will retry next heartbeat: %v", err)
	}
}
