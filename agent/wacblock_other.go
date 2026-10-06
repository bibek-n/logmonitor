//go:build !windows && !darwin && !linux

package main

// ApplyWacBlocklist is a no-op on platforms other than Windows, macOS, and Linux (see
// wacblock_windows.go, wacblock_darwin.go, and wacblock_linux.go respectively). Website
// Access Control enforcement has no implementation for whatever GOOS is left (e.g. BSD) -
// not expected to ever actually build for this agent's supported release targets today.
func ApplyWacBlocklist(client *Client, domains []string) {}

// WacStatus mirrors the real implementations' accessor so client.go's Heartbeat() can report
// back applied-state/errors uniformly regardless of platform - always empty here since
// ApplyWacBlocklist never applies anything on this platform.
func WacStatus() ([]string, string) { return nil, "" }
