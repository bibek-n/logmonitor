package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
)

// Config is written once at enrollment time and read on every agent start. Screenshot
// interval and privacy mode are deliberately NOT stored here — they're pulled live from
// the heartbeat response so an admin's change takes effect within one heartbeat interval
// without touching the endpoint.
type Config struct {
	ServerURL                string `json:"serverUrl"`
	DeviceID                 string `json:"deviceId"`
	APIKey                   string `json:"apiKey"`
	HeartbeatIntervalSeconds int    `json:"heartbeatIntervalSeconds"`
}

// ConfigPath returns the OS-appropriate config file location. Windows: ProgramData (a
// machine-wide, non-user-profile location suitable for a service running as SYSTEM).
// Linux: /etc, matching how system daemons store their config.
func ConfigPath() string {
	if runtime.GOOS == "windows" {
		root := os.Getenv("ProgramData")
		if root == "" {
			root = `C:\ProgramData`
		}
		return filepath.Join(root, "LogMonitorAgent", "config.json")
	}
	return "/etc/logmonitor-agent/config.json"
}

func LoadConfig() (*Config, error) {
	data, err := os.ReadFile(ConfigPath())
	if err != nil {
		return nil, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	if cfg.HeartbeatIntervalSeconds <= 0 {
		cfg.HeartbeatIntervalSeconds = 30
	}
	return &cfg, nil
}

func SaveConfig(cfg *Config) error {
	path := ConfigPath()
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}
