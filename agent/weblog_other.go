//go:build !windows

package main

// IIS web log tailing is a Windows-only concept - this stub exists only so run.go's
// unconditional `go runWeblogTailing(...)` call compiles on every platform. Linux web log
// ingestion (nginx/apache access logs) is a separate follow-up phase, not this one.
func runWeblogTailing(client *Client, stop <-chan struct{}) {}
