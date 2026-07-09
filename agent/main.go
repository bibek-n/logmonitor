package main

import (
	"flag"
	"fmt"
	"os"
	"runtime"
)

func hostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "unknown-host"
	}
	return h
}

func usage() {
	fmt.Println("LogMonitor Endpoint Agent")
	fmt.Println()
	if runtime.GOOS == "windows" {
		fmt.Println("  agent.exe install --token=<TOKEN> --server=<SERVER_URL>   Enroll + register as a Windows service (run as administrator)")
		fmt.Println("  agent.exe uninstall                                       Stop and remove the Windows service")
		fmt.Println("  agent.exe run                                             Run in the foreground (for testing)")
	} else {
		fmt.Println("  agent enroll --token=<TOKEN> --server=<SERVER_URL> --consent-accepted   Enroll this device (normally called by install.sh)")
		fmt.Println("  agent run                                                               Run in the foreground (normally invoked by systemd)")
	}
}

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "install":
		cmdInstall(os.Args[2:])
	case "enroll":
		cmdEnroll(os.Args[2:])
	case "uninstall":
		if err := UninstallService(); err != nil {
			fmt.Fprintln(os.Stderr, "uninstall failed:", err)
			os.Exit(1)
		}
	case "run":
		if err := RunService(); err != nil {
			fmt.Fprintln(os.Stderr, "run failed:", err)
			os.Exit(1)
		}
	default:
		usage()
		os.Exit(1)
	}
}

// cmdInstall is the Windows-focused flow: the .exe itself is the installer. It shows a
// native consent dialog, enrolls with the server, saves the config, and registers +
// starts the Windows service — all in one attended run by whoever executes the command.
func cmdInstall(args []string) {
	fs := flag.NewFlagSet("install", flag.ExitOnError)
	token := fs.String("token", "", "one-time enrollment token")
	server := fs.String("server", "", "server URL, e.g. https://logs.tulipshrm.com:4433")
	fs.Parse(args)

	if *token == "" || *server == "" {
		fmt.Fprintln(os.Stderr, "usage: agent.exe install --token=<TOKEN> --server=<SERVER_URL>")
		os.Exit(1)
	}

	if !ShowConsentDialog() {
		fmt.Fprintln(os.Stderr, "Consent was not given — aborting installation.")
		os.Exit(1)
	}

	resp, err := Enroll(*server, *token, hostname(), HostVersion())
	if err != nil {
		fmt.Fprintln(os.Stderr, "enrollment failed:", err)
		os.Exit(1)
	}

	cfg := &Config{
		ServerURL:                *server,
		DeviceID:                 resp.DeviceID,
		APIKey:                   resp.APIKey,
		HeartbeatIntervalSeconds: 30,
	}
	if err := SaveConfig(cfg); err != nil {
		fmt.Fprintln(os.Stderr, "failed to save config:", err)
		os.Exit(1)
	}

	if err := InstallService(); err != nil {
		fmt.Fprintln(os.Stderr, "service install failed:", err)
		os.Exit(1)
	}

	fmt.Println("Enrolled as device", resp.DeviceID, "- agent service installed and started.")
}

// cmdEnroll is the Linux-focused flow, called by install.sh only after it has collected
// interactive consent at the terminal (see install.sh) — --consent-accepted is required
// and is not something a script should ever set without a human having agreed.
func cmdEnroll(args []string) {
	fs := flag.NewFlagSet("enroll", flag.ExitOnError)
	token := fs.String("token", "", "one-time enrollment token")
	server := fs.String("server", "", "server URL")
	consentAccepted := fs.Bool("consent-accepted", false, "must be true; only set after interactive consent")
	fs.Parse(args)

	if *token == "" || *server == "" || !*consentAccepted {
		fmt.Fprintln(os.Stderr, "usage: agent enroll --token=<TOKEN> --server=<SERVER_URL> --consent-accepted")
		os.Exit(1)
	}

	resp, err := Enroll(*server, *token, hostname(), HostVersion())
	if err != nil {
		fmt.Fprintln(os.Stderr, "enrollment failed:", err)
		os.Exit(1)
	}

	cfg := &Config{
		ServerURL:                *server,
		DeviceID:                 resp.DeviceID,
		APIKey:                   resp.APIKey,
		HeartbeatIntervalSeconds: 30,
	}
	if err := SaveConfig(cfg); err != nil {
		fmt.Fprintln(os.Stderr, "failed to save config:", err)
		os.Exit(1)
	}

	fmt.Println("Enrolled as device", resp.DeviceID)
}
