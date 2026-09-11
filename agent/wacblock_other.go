//go:build !windows && !darwin

package main

// ApplyWacBlocklist is a no-op on platforms other than Windows and macOS (see
// wacblock_windows.go and wacblock_darwin.go respectively). Website Access Control
// enforcement has no Linux implementation yet.
func ApplyWacBlocklist(client *Client, domains []string) {}

// WacStatus mirrors wacblock_windows.go's accessor so client.go's Heartbeat() can report back
// applied-state/errors uniformly regardless of platform - always empty here since
// ApplyWacBlocklist never applies anything on this platform.
func WacStatus() ([]string, string) { return nil, "" }
