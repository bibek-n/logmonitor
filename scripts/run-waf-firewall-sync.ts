import "dotenv/config";
import { execFile } from "child_process";
import { promisify } from "util";
import { getDb } from "../src/lib/db";

const execFileAsync = promisify(execFile);

// This is the literal execution service Intrusion Detection's schema comment calls "Phase 2 -
// schema now, execution service not yet built" (pending task #261) - it reads active
// SecurityIpBlocklist rows (Intrusion Detection's existing table; the admin-facing "Block IP"
// button already writes here via /api/admin/intrusion-detection/blocklist, but that route
// explicitly does NOT touch Windows Firewall/IIS) and syncs them to real Windows Firewall
// block rules, since this is a single on-prem IIS box (192.168.1.15), not behind a cloud WAF.
//
// Idempotent by design: every rule this script creates is tagged under one DisplayGroup, so
// each run's diff (desired set from the DB vs. actual set from Get-NetFirewallRule) only ever
// adds/removes what changed since the last run - safe to run every minute.
const FIREWALL_DISPLAY_GROUP = "LogMonitor WAF";

interface BlocklistRow {
  IpOrCidr: string;
}

function ruleNameFor(ipOrCidr: string): string {
  // Firewall rule names can't contain most punctuation cleanly across all Windows builds -
  // encode the CIDR into a stable, safe identifier instead of using it verbatim.
  return `LogMonitorWAF-${ipOrCidr.replace(/[^0-9a-zA-Z]/g, "_")}`;
}

// Every IpOrCidr value is interpolated into a PowerShell -Command string below (New-
// NetFirewallRule has no Node equivalent) - this runs under an elevated Scheduled Task, so a
// value containing a stray quote/backtick could otherwise break out of the intended command.
// Strict allow-list validation here is the actual injection guard, not the surrounding single
// quotes alone.
const IP_OR_CIDR_RE = /^[0-9a-fA-F:.]+(\/\d{1,3})?$/;

async function getDesiredBlockedIps(): Promise<string[]> {
  const db = await getDb();
  const result = await db.query<BlocklistRow>(
    "SELECT IpOrCidr FROM SecurityIpBlocklist WHERE IsActive = 1 AND (ExpiresAt IS NULL OR ExpiresAt > SYSUTCDATETIME())"
  );
  const valid: string[] = [];
  for (const row of result.recordset) {
    if (IP_OR_CIDR_RE.test(row.IpOrCidr)) {
      valid.push(row.IpOrCidr);
    } else {
      console.warn(`Skipping SecurityIpBlocklist entry with unexpected format (not a plain IP/CIDR): ${JSON.stringify(row.IpOrCidr)}`);
    }
  }
  return valid;
}

async function getExistingWafRuleNames(): Promise<string[]> {
  const { stdout } = await execFileAsync("powershell", [
    "-NoProfile",
    "-Command",
    `Get-NetFirewallRule -DisplayGroup '${FIREWALL_DISPLAY_GROUP}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name`,
  ]);
  return stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

async function addBlockRule(ipOrCidr: string): Promise<void> {
  const name = ruleNameFor(ipOrCidr);
  await execFileAsync("powershell", [
    "-NoProfile",
    "-Command",
    `New-NetFirewallRule -Name '${name}' -DisplayName '${name}' -DisplayGroup '${FIREWALL_DISPLAY_GROUP}' -Direction Inbound -Action Block -RemoteAddress '${ipOrCidr}' -Profile Any | Out-Null`,
  ]);
}

async function removeRule(ruleName: string): Promise<void> {
  await execFileAsync("powershell", ["-NoProfile", "-Command", `Remove-NetFirewallRule -Name '${ruleName}' -ErrorAction SilentlyContinue`]);
}

async function main() {
  const desiredIps = await getDesiredBlockedIps();
  const desiredRuleNames = new Set(desiredIps.map(ruleNameFor));
  const existingRuleNames = await getExistingWafRuleNames();
  const existingSet = new Set(existingRuleNames);

  let added = 0;
  for (const ip of desiredIps) {
    const name = ruleNameFor(ip);
    if (!existingSet.has(name)) {
      await addBlockRule(ip);
      added++;
    }
  }

  let removed = 0;
  for (const ruleName of existingRuleNames) {
    if (!desiredRuleNames.has(ruleName)) {
      await removeRule(ruleName);
      removed++;
    }
  }

  console.log(`WAF firewall sync: ${desiredIps.length} desired block rule(s), added ${added}, removed ${removed}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
