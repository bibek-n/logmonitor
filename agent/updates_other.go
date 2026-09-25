//go:build !windows && !linux && !darwin

package main

func collectUpdatesPlatform() UpdateScan {
	return UpdateScan{Supported: false, Warnings: []string{"update scanning is not supported on this operating system"}}
}
