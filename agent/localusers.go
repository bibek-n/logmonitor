package main

import (
	"runtime"
	"strconv"
	"strings"
)

// LocalUserInfo describes one local OS account on the device - collected alongside
// hardware/software inventory (same "mostly static, re-sent daily" cadence, see run.go)
// so an admin can see who has login access to a machine without needing to check it
// directly on the console.
type LocalUserInfo struct {
	Username   string `json:"username"`
	FullName   string `json:"fullName"`
	IsAdmin    bool   `json:"isAdmin"`
	IsDisabled bool   `json:"isDisabled"`
	LastLogon  string `json:"lastLogon"`
}

func CollectLocalUsers() []LocalUserInfo {
	if runtime.GOOS == "windows" {
		return collectWindowsLocalUsers()
	}
	return collectLinuxLocalUsers()
}

// Uses Get-LocalUser / Get-LocalGroupMember rather than the older `net user` command -
// net user's fixed-width columnar output is fragile to parse (long names get truncated/
// wrapped) and doesn't expose Enabled/LastLogon directly. Pipe-delimited, one user per
// line, so parsing doesn't need to guess column widths.
func collectWindowsLocalUsers() []LocalUserInfo {
	admins := map[string]bool{}
	if out := runOut("powershell", "-NoProfile", "-Command",
		"Get-LocalGroupMember -Group 'Administrators' -ErrorAction SilentlyContinue | ForEach-Object { ($_.Name -split '\\\\')[-1] }"); out != "" {
		for _, name := range strings.Split(out, "\n") {
			if name = strings.TrimSpace(name); name != "" {
				admins[strings.ToLower(name)] = true
			}
		}
	}

	out := runOut("powershell", "-NoProfile", "-Command",
		"Get-LocalUser | ForEach-Object { \"$($_.Name)|$($_.FullName)|$($_.Enabled)|$($_.LastLogon)\" }")
	if out == "" {
		return nil
	}

	var users []LocalUserInfo
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "|", 4)
		if len(parts) != 4 {
			continue
		}
		username := strings.TrimSpace(parts[0])
		if username == "" {
			continue
		}
		users = append(users, LocalUserInfo{
			Username:   username,
			FullName:   strings.TrimSpace(parts[1]),
			IsAdmin:    admins[strings.ToLower(username)],
			IsDisabled: strings.EqualFold(strings.TrimSpace(parts[2]), "False"),
			LastLogon:  strings.TrimSpace(parts[3]),
		})
	}
	return users
}

// /etc/passwd entries with UID 0 or UID >= 1000 and a real login shell are treated as
// "real" accounts - system/service accounts (UID < 1000, or a nologin/false shell) are
// excluded, the same convention `lslogins --user` draws, since listing every one of the
// ~40 system accounts on a typical distro would bury the handful of accounts a human can
// actually log in as.
func collectLinuxLocalUsers() []LocalUserInfo {
	out := runOut("getent", "passwd")
	if out == "" {
		return nil
	}

	adminNames := map[string]bool{}
	for _, group := range []string{"sudo", "wheel"} {
		members := runOut("getent", "group", group)
		if members == "" {
			continue
		}
		if idx := strings.LastIndex(members, ":"); idx >= 0 {
			for _, name := range strings.Split(members[idx+1:], ",") {
				if name = strings.TrimSpace(name); name != "" {
					adminNames[name] = true
				}
			}
		}
	}

	var users []LocalUserInfo
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Split(line, ":")
		if len(fields) < 7 {
			continue
		}
		username, uidStr, fullName, shell := fields[0], fields[2], fields[4], fields[6]
		uid, err := strconv.Atoi(uidStr)
		if err != nil {
			continue
		}
		isNoLogin := strings.Contains(shell, "nologin") || strings.Contains(shell, "/false")
		if uid != 0 && (uid < 1000 || isNoLogin) {
			continue
		}
		users = append(users, LocalUserInfo{
			Username:   username,
			FullName:   strings.SplitN(fullName, ",", 2)[0],
			IsAdmin:    uid == 0 || adminNames[username],
			IsDisabled: isNoLogin,
		})
	}
	return users
}
