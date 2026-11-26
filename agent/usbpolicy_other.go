//go:build !windows

package main

// ApplyUsbPolicy is a no-op on non-Windows platforms. USB enforcement (Windows Device
// Installation Restrictions, Disable-PnpDevice) is Windows-specific, and Linux USB detection
// (usb_linux.go, via lsblk) doesn't even capture vendor/product IDs to match a policy entry
// against, so there's nothing this could act on here.
func ApplyUsbPolicy(client *Client, policy UsbPolicy) {}

// EnforceUsbPolicyOnPoll is a no-op on non-Windows platforms, for the same reason.
func EnforceUsbPolicyOnPoll(client *Client, current []UsbDeviceInfo) {}
