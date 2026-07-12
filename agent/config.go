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

// ChatConfig is a deliberately separate, narrower file from Config: it holds only what the
// chat companion (agent/chattray) needs — never the device's APIKey. The companion runs in
// the logged-in user's own desktop session (not as SYSTEM/root like the main agent), so this
// file is written world-readable; ChatToken only ever grants access to that one employee's
// own chat thread, never telemetry, so that's an acceptable trade for not having to run the
// companion privileged just to read a credential file.
type ChatConfig struct {
	ServerURL string `json:"serverUrl"`
	DeviceID  string `json:"deviceId"`
	ChatToken string `json:"chatToken"`
}

func ChatConfigPath() string {
	return filepath.Join(filepath.Dir(ConfigPath()), "chat-config.json")
}

func LoadChatConfig() (*ChatConfig, error) {
	data, err := os.ReadFile(ChatConfigPath())
	if err != nil {
		return nil, err
	}
	var cfg ChatConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func SaveChatConfig(cfg *ChatConfig) error {
	path := ChatConfigPath()
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	// SaveConfig (the main, sensitive config) creates this same directory with 0700 before
	// this ever runs — MkdirAll is a no-op on an already-existing directory, so the mode
	// above wouldn't actually loosen it. Chmod explicitly to 0755 so a non-owner user can at
	// least traverse into the directory to read chat-config.json; the main config.json
	// alongside it keeps its own restrictive 0600 file mode regardless of the directory's
	// permissions.
	if err := os.Chmod(dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		return err
	}
	// os.WriteFile applies the umask on Linux, which can leave this narrower than 0644 —
	// Chmod explicitly so any locally logged-in user can read it regardless of umask.
	return os.Chmod(path, 0644)
}
