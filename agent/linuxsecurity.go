package main

import (
	"context"
	"log"
	"os/exec"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// Some of these checks (SUID binary scan from /, sudoers grep across /etc/sudoers.d/) can
// legitimately take longer than the shared 10s subprocessTimeout (see hardware.go) on a box
// with a large filesystem - same reasoning as iis.go's longPowerShellTimeout, a dedicated
// budget instead of raising the shared one every fast collector relies on staying tight.
const linuxSecurityTimeout = 30 * time.Second
const linuxSecurityPollInterval = 5 * time.Minute

// LinuxSecurityDetected gates this entire collector - a Windows agent never runs any of
// these commands, and the server only shows the "Server Security" cards once a device
// reports detected=true.
func LinuxSecurityDetected() bool {
	return runtime.GOOS == "linux"
}

// runShell's context timeout only ever kills the immediate "sh" process by default - for a
// piped command like "find / ... | head -n 200", sh forks find and head as its own children,
// and killing sh alone doesn't close the pipe they still hold open, so Output() can hang
// indefinitely waiting for EOF that never comes. Confirmed live: a SUID scan on a large
// git-hosting box ran 20+ minutes past this function's timeout, orphaned and still consuming
// CPU/memory, because the default cancellation never reached find/head at all. Putting the
// shell in its own process group and killing that whole group on cancellation (via
// configureProcessGroup/killProcessGroup - Linux-specific, no-op on Windows where this
// scenario doesn't arise) takes every descendant down with it.
func runShell(timeout time.Duration, command string) string {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, "sh", "-c", command)
	configureProcessGroup(cmd)
	cmd.Cancel = func() error { return killProcessGroup(cmd) }
	cmd.WaitDelay = 5 * time.Second
	out, _ := cmd.Output()
	return strings.TrimSpace(string(out))
}

type LinuxOpenPort struct {
	Protocol string `json:"protocol"`
	Address  string `json:"address"`
	Port     int    `json:"port"`
	Process  string `json:"process"`
}

type LinuxFail2banJail struct {
	Jail            string `json:"jail"`
	CurrentlyBanned int    `json:"currentlyBanned"`
	TotalBanned     int    `json:"totalBanned"`
}

// LinuxSecurityStatus is the full payload posted to /api/agent/linux-security-status,
// covering the 8 areas asked for: SSH, Firewall, Ports, Fail2Ban, SELinux, AppArmor,
// Permissions, Sudo. Every field is best-effort/nullable - a tool not installed (no
// firewalld, no fail2ban, no SELinux on a Debian box) degrades that one field to a
// not-installed marker rather than failing the whole collection.
type LinuxSecurityStatus struct {
	Detected bool `json:"detected"`

	SshPort                   *int   `json:"sshPort"`
	SshPermitRootLogin        string `json:"sshPermitRootLogin"`
	SshPasswordAuthentication string `json:"sshPasswordAuthentication"`
	SshServiceActive          *bool  `json:"sshServiceActive"`

	FirewallType      string `json:"firewallType"`
	FirewallActive    *bool  `json:"firewallActive"`
	FirewallRuleCount *int   `json:"firewallRuleCount"`

	OpenPorts []LinuxOpenPort `json:"openPorts"`

	Fail2banInstalled *bool               `json:"fail2banInstalled"`
	Fail2banActive    *bool               `json:"fail2banActive"`
	Fail2banJails     []LinuxFail2banJail `json:"fail2banJails"`

	SelinuxStatus string `json:"selinuxStatus"`

	ApparmorStatus        string `json:"apparmorStatus"`
	ApparmorEnforceCount  *int   `json:"apparmorEnforceCount"`
	ApparmorComplainCount *int   `json:"apparmorComplainCount"`

	WorldWritableFileCount *int     `json:"worldWritableFileCount"`
	WorldWritableSamples   []string `json:"worldWritableSamples"`
	SuidBinaryCount        *int     `json:"suidBinaryCount"`
	SuidBinarySamples      []string `json:"suidBinarySamples"`

	SudoNopasswdCount   *int     `json:"sudoNopasswdCount"`
	SudoNopasswdEntries []string `json:"sudoNopasswdEntries"`
}

func nonEmptyLines(s string) []string {
	var out []string
	for _, l := range strings.Split(s, "\n") {
		l = strings.TrimSpace(l)
		if l != "" {
			out = append(out, l)
		}
	}
	return out
}

func firstInt(s string) int {
	fields := strings.Fields(s)
	if len(fields) == 0 {
		return 0
	}
	n, _ := strconv.Atoi(fields[0])
	return n
}

func lastFieldInt(line string) int {
	parts := strings.Split(line, ":")
	if len(parts) < 2 {
		return 0
	}
	n, _ := strconv.Atoi(strings.TrimSpace(parts[len(parts)-1]))
	return n
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

func firstN(items []string, n int) []string {
	if len(items) <= n {
		return items
	}
	return items[:n]
}

// collectSsh prefers `sshd -T`, which dumps sshd's fully-resolved effective configuration
// (defaults included) rather than raw sshd_config text - modern OpenSSH's actual default for
// PermitRootLogin is "prohibit-password", not "yes", so grepping the file alone would
// under-report root-login risk on a host that never explicitly sets the directive. Falls
// back to grepping the raw file only if `sshd -T` isn't available/fails (needs root, which
// the agent runs as).
func collectSsh() (sshPort *int, permitRootLogin, passwordAuth string, active *bool) {
	permitRootLogin = "unknown"
	passwordAuth = "unknown"

	effective := runShell(linuxSecurityTimeout, "sshd -T 2>/dev/null")
	if effective == "" {
		effective = runShell(linuxSecurityTimeout, `grep -Ei '^(port|permitrootlogin|passwordauthentication)[[:space:]]' /etc/ssh/sshd_config 2>/dev/null`)
	}
	for _, line := range strings.Split(effective, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		key := strings.ToLower(fields[0])
		val := fields[1]
		switch key {
		case "port":
			if p, err := strconv.Atoi(val); err == nil {
				sshPort = &p
			}
		case "permitrootlogin":
			permitRootLogin = val
		case "passwordauthentication":
			passwordAuth = val
		}
	}
	if sshPort == nil {
		p := 22
		sshPort = &p
	}

	statusOut := runShell(linuxSecurityTimeout, "systemctl is-active ssh 2>/dev/null || systemctl is-active sshd 2>/dev/null")
	a := statusOut == "active"
	active = &a
	return
}

// collectFirewall checks the three common Linux firewall front-ends in order of how likely
// each is to be the one actually in charge (ufw on Debian/Ubuntu, firewalld on RHEL/Fedora,
// falling back to raw iptables rule counting when neither management layer is installed).
func collectFirewall() (fwType string, active *bool, ruleCount *int) {
	if runShell(linuxSecurityTimeout, "command -v ufw") != "" {
		fwType = "ufw"
		out := runShell(linuxSecurityTimeout, "ufw status 2>/dev/null")
		a := strings.Contains(strings.ToLower(out), "status: active")
		active = &a
		count := 0
		for _, line := range strings.Split(out, "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "Status:") || strings.HasPrefix(line, "To") || strings.HasPrefix(line, "--") {
				continue
			}
			count++
		}
		ruleCount = &count
		return
	}
	if runShell(linuxSecurityTimeout, "command -v firewall-cmd") != "" {
		fwType = "firewalld"
		state := runShell(linuxSecurityTimeout, "firewall-cmd --state 2>/dev/null")
		a := strings.TrimSpace(state) == "running"
		active = &a
		ports := runShell(linuxSecurityTimeout, "firewall-cmd --list-ports 2>/dev/null")
		services := runShell(linuxSecurityTimeout, "firewall-cmd --list-services 2>/dev/null")
		count := len(strings.Fields(ports)) + len(strings.Fields(services))
		ruleCount = &count
		return
	}
	if runShell(linuxSecurityTimeout, "command -v iptables") != "" {
		fwType = "iptables"
		out := runShell(linuxSecurityTimeout, "iptables -S 2>/dev/null")
		lines := len(nonEmptyLines(out))
		ruleCount = &lines
		// The 3 default `-P <chain> ACCEPT` policy lines exist even with no custom rules at
		// all - more than that means someone has actually configured iptables directly.
		a := lines > 3
		active = &a
		return
	}
	fwType = "none"
	return
}

var listenLineRe = regexp.MustCompile(`^\S+\s+\S+\s+\S+\s+(\S+):(\d+)\s+\S+\s+users:\(\("([^"]+)"`)

// collectOpenPorts parses `ss -tlnp` (falling back to `netstat -tlnp` on hosts where ss isn't
// installed) - the regex splits "address:port" on the LAST colon rather than the first,
// which is what makes it work for both "0.0.0.0:22" and IPv6's "[::]:22" without special-
// casing either.
func collectOpenPorts() []LinuxOpenPort {
	out := runShell(linuxSecurityTimeout, "ss -tlnp 2>/dev/null")
	if out == "" {
		out = runShell(linuxSecurityTimeout, "netstat -tlnp 2>/dev/null")
	}
	var ports []LinuxOpenPort
	seen := map[string]bool{}
	for _, line := range strings.Split(out, "\n") {
		m := listenLineRe.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		port, err := strconv.Atoi(m[2])
		if err != nil {
			continue
		}
		key := m[1] + ":" + m[2]
		if seen[key] {
			continue
		}
		seen[key] = true
		ports = append(ports, LinuxOpenPort{Protocol: "tcp", Address: m[1], Port: port, Process: m[3]})
	}
	return ports
}

func collectFail2ban() (installed *bool, active *bool, jails []LinuxFail2banJail) {
	hasClient := runShell(linuxSecurityTimeout, "command -v fail2ban-client") != ""
	installed = &hasClient
	if !hasClient {
		return
	}

	statusOut := runShell(linuxSecurityTimeout, "systemctl is-active fail2ban 2>/dev/null")
	a := statusOut == "active"
	active = &a
	if !a {
		return
	}

	out := runShell(linuxSecurityTimeout, "fail2ban-client status 2>/dev/null")
	var jailNames []string
	for _, line := range strings.Split(out, "\n") {
		if !strings.Contains(line, "Jail list:") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		for _, j := range strings.Split(parts[1], ",") {
			j = strings.TrimSpace(j)
			if j != "" {
				jailNames = append(jailNames, j)
			}
		}
	}

	for _, jail := range jailNames {
		jOut := runShell(linuxSecurityTimeout, "fail2ban-client status "+shellQuote(jail)+" 2>/dev/null")
		var current, total int
		for _, line := range strings.Split(jOut, "\n") {
			if strings.Contains(line, "Currently banned:") {
				current = lastFieldInt(line)
			}
			if strings.Contains(line, "Total banned:") {
				total = lastFieldInt(line)
			}
		}
		jails = append(jails, LinuxFail2banJail{Jail: jail, CurrentlyBanned: current, TotalBanned: total})
	}
	return
}

func collectSelinux() string {
	if runShell(linuxSecurityTimeout, "command -v getenforce") == "" {
		return "NotInstalled"
	}
	out := runShell(linuxSecurityTimeout, "getenforce 2>/dev/null")
	if out == "" {
		return "Unknown"
	}
	return out
}

func collectApparmor() (status string, enforceCount, complainCount *int) {
	if runShell(linuxSecurityTimeout, "command -v aa-status") == "" {
		status = "NotInstalled"
		return
	}
	out := runShell(linuxSecurityTimeout, "aa-status 2>/dev/null")
	if out == "" {
		status = "Unknown"
		return
	}
	status = "Active"
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if strings.Contains(line, "profiles are in enforce mode") {
			n := firstInt(line)
			enforceCount = &n
		}
		if strings.Contains(line, "profiles are in complain mode") {
			n := firstInt(line)
			complainCount = &n
		}
	}
	return
}

// collectPermissions scopes the world-writable scan to the directories that actually matter
// for a webserver/app host (/etc, /var/www, /home, /opt) with -xdev so it never wanders onto
// a different mounted filesystem - scanning the entire disk for this would be both slow and
// mostly noise (/proc, /sys, container overlays, etc). The SUID scan does cover the whole
// root filesystem (-xdev still applies, so it won't cross mount points) since the real count
// of SUID binaries on a normal box is small (dozens, not thousands) and finding an
// unexpected one anywhere on the root filesystem is exactly the point of this check.
func collectPermissions() (worldWritableCount *int, worldWritableSamples []string, suidCount *int, suidSamples []string) {
	wwOut := runShell(linuxSecurityTimeout, "find /etc /var/www /home /opt -xdev -type f -perm -0002 2>/dev/null | head -n 200")
	wwLines := nonEmptyLines(wwOut)
	c1 := len(wwLines)
	worldWritableCount = &c1
	worldWritableSamples = firstN(wwLines, 20)

	suidOut := runShell(linuxSecurityTimeout, "find / -xdev -type f -perm -4000 2>/dev/null | head -n 200")
	suidLines := nonEmptyLines(suidOut)
	c2 := len(suidLines)
	suidCount = &c2
	suidSamples = firstN(suidLines, 20)
	return
}

// collectSudo greps for NOPASSWD across /etc/sudoers and /etc/sudoers.d/* - a NOPASSWD entry
// means the named user/group can run those commands without re-authenticating, which is
// exactly the kind of thing worth surfacing on a security dashboard (it's also why the
// enrolled Laravel-Dev box's own `wslaravel` account, set up with unrestricted NOPASSWD sudo
// for automated backup checks, is expected to show up here rather than being a bug).
func collectSudo() (count *int, entries []string) {
	out := runShell(linuxSecurityTimeout, `grep -rEn "NOPASSWD" /etc/sudoers /etc/sudoers.d/ 2>/dev/null | grep -v '^[^:]*:[0-9]*:[[:space:]]*#'`)
	lines := nonEmptyLines(out)
	c := len(lines)
	count = &c
	entries = firstN(lines, 30)
	return
}

// CollectLinuxSecurityStatus is best-effort throughout, same philosophy as every other
// collector in this agent: a missing tool (no firewalld, no SELinux, no fail2ban) degrades
// that one field rather than failing the whole pass, and each sub-collector is independently
// isolated so one slow/failing command can't blank out the others.
func CollectLinuxSecurityStatus() LinuxSecurityStatus {
	out := LinuxSecurityStatus{Detected: true}
	if !LinuxSecurityDetected() {
		out.Detected = false
		return out
	}

	sshPort, permitRootLogin, passwordAuth, sshActive := collectSsh()
	out.SshPort = sshPort
	out.SshPermitRootLogin = permitRootLogin
	out.SshPasswordAuthentication = passwordAuth
	out.SshServiceActive = sshActive

	fwType, fwActive, fwRuleCount := collectFirewall()
	out.FirewallType = fwType
	out.FirewallActive = fwActive
	out.FirewallRuleCount = fwRuleCount

	out.OpenPorts = collectOpenPorts()

	f2bInstalled, f2bActive, f2bJails := collectFail2ban()
	out.Fail2banInstalled = f2bInstalled
	out.Fail2banActive = f2bActive
	out.Fail2banJails = f2bJails

	out.SelinuxStatus = collectSelinux()

	apparmorStatus, enforceCount, complainCount := collectApparmor()
	out.ApparmorStatus = apparmorStatus
	out.ApparmorEnforceCount = enforceCount
	out.ApparmorComplainCount = complainCount

	wwCount, wwSamples, suidCount, suidSamples := collectPermissions()
	out.WorldWritableFileCount = wwCount
	out.WorldWritableSamples = wwSamples
	out.SuidBinaryCount = suidCount
	out.SuidBinarySamples = suidSamples

	sudoCount, sudoEntries := collectSudo()
	out.SudoNopasswdCount = sudoCount
	out.SudoNopasswdEntries = sudoEntries

	return out
}

// runLinuxSecurityPolling runs on its own ticker, decoupled from the main heartbeat loop,
// same pattern as runIisPolling/runUsbPolling - these checks are slow-changing (SSH config,
// firewall rules, SELinux mode rarely flip minute to minute) so a 5-minute cadence is plenty,
// and keeping it off the main loop means a slow `find /` scan can never delay a heartbeat.
func runLinuxSecurityPolling(client *Client, stop <-chan struct{}) {
	ticker := time.NewTicker(linuxSecurityPollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			if LinuxSecurityDetected() {
				if err := client.PostLinuxSecurityStatus(CollectLinuxSecurityStatus()); err != nil {
					log.Printf("linux security status upload failed: %v", err)
				}
			}
		}
	}
}
