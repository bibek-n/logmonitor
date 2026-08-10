//go:build !windows

package main

// ApplyWacBlocklist is a no-op on non-Windows platforms. Website Access Control enforcement
// (hosts-file blocking, Chrome/Edge/Firefox DoH policy management - see wacblock_windows.go)
// is a Windows-specific implementation for now; there is no equivalent wired up here yet.
func ApplyWacBlocklist(client *Client, domains []string) {}

// WacStatus mirrors wacblock_windows.go's accessor so client.go's Heartbeat() can report back
// applied-state/errors uniformly regardless of platform - always empty here since
// ApplyWacBlocklist never applies anything on this platform.
func WacStatus() ([]string, string) { return nil, "" }
