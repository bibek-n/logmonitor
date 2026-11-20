import { getDb, sql } from "../db";

// v2 - replaces the old deduct-from-100 heuristic (see git history / securityScore.test.ts
// before this change), which summed an *uncapped* per-finding deduction across
// VulnerabilityFindings + MalwareFindings + SecurityAlerts independently, then floored each at
// 0 and averaged. With any real-world standing alert backlog (this app had ~2,000+ open
// SecurityAlerts when this was found), as few as 5 criticals - or 17 mediums - in any ONE of
// those three unrelated tables floored that component to exactly 0, and the overall score
// collapsed to 0 with zero ability to differentiate "a little behind" from "on fire". That's
// the literal bug behind the "shows 0/100 with no explanation" complaint.
//
// v2 instead scores 5 weighted categories, each as a 0-100 "percent healthy" ratio (or a
// sanely-capped deduction where no natural ratio exists), so a large backlog still produces a
// differentiated, explainable number instead of an identical floor. Each category also reports
// exactly which entities (devices/users) are causing it to lose points, matching the spec's
// "Drill-down page: each category shows its points, what's failing, and which devices cause it."
//
// Wazuh agent coverage (which the original pasted spec suggested as a 6th category) has no
// backing data anywhere in this app - no agent-install/health table exists for it - so it's
// left out entirely and its weight redistributed, rather than fabricating a number. Same
// reasoning as src/lib/dashboardLayouts/queries.ts's own "excludes anything this app doesn't
// actually track yet" comment.

export type CategoryKey = "patching" | "alerts" | "endpointProtection" | "accountHygiene" | "backups";

export const CATEGORY_WEIGHTS: Record<CategoryKey, number> = {
  patching: 30,
  alerts: 25,
  endpointProtection: 20,
  accountHygiene: 15,
  backups: 10,
};

export interface FailingEntity {
  id: string;
  name: string;
  detail: string;
}

export interface CategoryScore {
  key: CategoryKey;
  label: string;
  weight: number;
  rawScore: number; // 0-100, health within this category alone
  points: number; // rawScore/100 * weight, rounded - what this category actually contributes
  summary: string;
  failingEntities: FailingEntity[];
}

export interface Recommendation {
  action: string;
  pointGain: number;
}

export interface SecurityScoreResult {
  overallScore: number;
  riskLevel: "Critical" | "High" | "Medium" | "Low";
  categories: CategoryScore[];
  recommendations: Recommendation[];
}

export function riskLevelForScore(score: number): "Critical" | "High" | "Medium" | "Low" {
  if (score < 40) return "Critical";
  if (score < 60) return "High";
  if (score < 80) return "Medium";
  return "Low";
}

function toPoints(rawScore: number, weight: number): number {
  return Math.round((Math.max(0, Math.min(100, rawScore)) / 100) * weight);
}

// Most recent scan per device, so a device scanned 5 times only counts once. A device is
// "healthy" here if its latest scan found no Critical/Security-classed pending updates -
// Application/Driver/Package-only pending updates don't count against this category.
async function scorePatching(): Promise<CategoryScore> {
  const db = await getDb();
  const result = await db.query<{ DeviceId: string; Hostname: string; CriticalCount: number; SecurityCount: number; PendingCount: number }>(`
    WITH Latest AS (
      SELECT DeviceId, CriticalCount, SecurityCount, PendingCount,
        ROW_NUMBER() OVER (PARTITION BY DeviceId ORDER BY ScannedAt DESC) AS rn
      FROM DeviceUpdateScans
    )
    SELECT l.DeviceId, d.Hostname, l.CriticalCount, l.SecurityCount, l.PendingCount
    FROM Latest l
    JOIN Devices d ON d.DeviceId = l.DeviceId
    WHERE l.rn = 1
  `);

  const rows = result.recordset;
  const failing = rows.filter((r) => r.CriticalCount > 0 || r.SecurityCount > 0);
  const rawScore = rows.length === 0 ? 100 : (100 * (rows.length - failing.length)) / rows.length;

  return {
    key: "patching",
    label: "Endpoint Patch Status",
    weight: CATEGORY_WEIGHTS.patching,
    rawScore,
    points: toPoints(rawScore, CATEGORY_WEIGHTS.patching),
    summary:
      rows.length === 0
        ? "No endpoint patch scans recorded yet."
        : `${rows.length - failing.length} of ${rows.length} scanned device(s) have no pending critical/security updates.`,
    failingEntities: failing
      .sort((a, b) => b.CriticalCount - a.CriticalCount || b.SecurityCount - a.SecurityCount)
      .map((r) => ({
        id: r.DeviceId,
        name: r.Hostname,
        detail: `${r.CriticalCount} critical, ${r.SecurityCount} security update(s) pending (${r.PendingCount} total)`,
      })),
  };
}

// Capped deduction rather than a ratio - there's no natural "total alert count" denominator
// (an org could legitimately have 0 or 10,000 depending on traffic), but an uncapped sum is
// exactly the bug this file exists to fix, so each severity's contribution is capped before
// summing. "Open" matches the exclusion already used elsewhere for this table (dashboardLayouts
// QuickStats): Resolved/FalsePositive/Suppressed don't count as open.
async function scoreAlerts(): Promise<CategoryScore> {
  const db = await getDb();
  const result = await db.query<{ Severity: string; RuleName: string | null; Cnt: number }>(`
    SELECT a.Severity, r.Name AS RuleName, COUNT(*) AS Cnt
    FROM SecurityAlerts a
    LEFT JOIN SecurityDetectionRules r ON r.Id = a.RuleId
    WHERE a.Status NOT IN ('Resolved', 'FalsePositive', 'Suppressed')
    GROUP BY a.Severity, r.Name
  `);

  const bySeverity = result.recordset.reduce<Record<string, number>>((acc, r) => {
    acc[r.Severity] = (acc[r.Severity] ?? 0) + r.Cnt;
    return acc;
  }, {});
  const critical = bySeverity.critical ?? 0;
  const high = bySeverity.high ?? 0;
  const medium = bySeverity.medium ?? 0;

  const deduction = Math.min(60, critical * 15) + Math.min(30, high * 5) + Math.min(15, medium * 1);
  const rawScore = Math.max(0, 100 - deduction);

  const topRules = [...result.recordset]
    .filter((r) => r.Severity === "critical" || r.Severity === "high")
    .sort((a, b) => b.Cnt - a.Cnt)
    .slice(0, 10)
    .map((r) => ({ id: r.RuleName ?? "unknown-rule", name: r.RuleName ?? "Unknown rule", detail: `${r.Cnt} open ${r.Severity} alert(s)` }));

  return {
    key: "alerts",
    label: "Open Critical Alerts",
    weight: CATEGORY_WEIGHTS.alerts,
    rawScore,
    points: toPoints(rawScore, CATEGORY_WEIGHTS.alerts),
    summary: critical + high === 0 ? "No open critical or high-severity alerts." : `${critical} critical, ${high} high-severity alert(s) still open.`,
    failingEntities: topRules,
  };
}

// A device counts against this category if its most recent security-status report shows the
// firewall disabled or antivirus not in a running/enabled state - same "not enabled/running"
// test already used by dashboardLayouts' AvDisabled count, kept consistent rather than
// reinventing a slightly different threshold here.
async function scoreEndpointProtection(): Promise<CategoryScore> {
  const db = await getDb();
  const result = await db.query<{ DeviceId: string; Hostname: string; FirewallEnabled: boolean | null; AntivirusStatus: string | null }>(`
    SELECT s.DeviceId, d.Hostname, s.FirewallEnabled, s.AntivirusStatus
    FROM DeviceSecurityStatus s
    JOIN Devices d ON d.DeviceId = s.DeviceId
  `);

  const rows = result.recordset;
  const failing = rows.filter((r) => r.FirewallEnabled === false || (r.AntivirusStatus !== null && !["Enabled", "enabled", "Running", "running"].includes(r.AntivirusStatus)));
  const rawScore = rows.length === 0 ? 100 : (100 * (rows.length - failing.length)) / rows.length;

  return {
    key: "endpointProtection",
    label: "Firewall & Endpoint Protection",
    weight: CATEGORY_WEIGHTS.endpointProtection,
    rawScore,
    points: toPoints(rawScore, CATEGORY_WEIGHTS.endpointProtection),
    summary:
      rows.length === 0
        ? "No endpoint security-status reports recorded yet."
        : `${rows.length - failing.length} of ${rows.length} device(s) have firewall enabled and antivirus running.`,
    failingEntities: failing.map((r) => ({
      id: r.DeviceId,
      name: r.Hostname,
      detail: [r.FirewallEnabled === false ? "firewall disabled" : null, r.AntivirusStatus && !["Enabled", "enabled", "Running", "running"].includes(r.AntivirusStatus) ? `antivirus: ${r.AntivirusStatus}` : null]
        .filter(Boolean)
        .join(", "),
    })),
  };
}

// "Healthy" = 2FA enabled AND password changed within the last 90 days. Only counts active
// admin accounts - a disabled account's stale password isn't a live risk.
const PASSWORD_MAX_AGE_DAYS = 90;

async function scoreAccountHygiene(): Promise<CategoryScore> {
  const db = await getDb();
  const result = await db.query<{ Id: number; Username: string; TotpEnabled: boolean; PasswordChangedAt: string | null }>(`
    SELECT Id, Username, TotpEnabled, CONVERT(VARCHAR(19), PasswordChangedAt, 126) AS PasswordChangedAt
    FROM Users WHERE IsActive = 1
  `);

  const rows = result.recordset;
  const now = Date.now();
  const failing = rows.filter((u) => {
    const passwordStale = !u.PasswordChangedAt || now - new Date(u.PasswordChangedAt).getTime() > PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    return !u.TotpEnabled || passwordStale;
  });
  const rawScore = rows.length === 0 ? 100 : (100 * (rows.length - failing.length)) / rows.length;

  return {
    key: "accountHygiene",
    label: "Admin Account Hygiene",
    weight: CATEGORY_WEIGHTS.accountHygiene,
    rawScore,
    points: toPoints(rawScore, CATEGORY_WEIGHTS.accountHygiene),
    summary: rows.length === 0 ? "No active admin accounts found." : `${rows.length - failing.length} of ${rows.length} active account(s) have 2FA enabled and a password changed within ${PASSWORD_MAX_AGE_DAYS} days.`,
    failingEntities: failing.map((u) => {
      const passwordStale = !u.PasswordChangedAt || now - new Date(u.PasswordChangedAt).getTime() > PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
      return {
        id: String(u.Id),
        name: u.Username,
        detail: [!u.TotpEnabled ? "2FA not enabled" : null, passwordStale ? "password not changed in 90+ days" : null].filter(Boolean).join(", "),
      };
    }),
  };
}

// Binary by design (most environments have one DB backup job, not a fleet to average over):
// 100 if the most recent run succeeded within the last 48 hours, 0 otherwise (never run,
// stale, or the last run failed) - a backup that "ran fine 9 days ago" is not meaningfully
// different from "never configured" for recovery purposes.
const BACKUP_MAX_AGE_HOURS = 48;

async function scoreBackups(): Promise<CategoryScore> {
  const db = await getDb();
  const result = await db.query<{ Status: string; FileName: string; CreatedAt: string }>(
    `SELECT TOP 1 Status, FileName, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt FROM BackupHistory ORDER BY CreatedAt DESC`
  );
  const last = result.recordset[0];
  const ageHours = last ? (Date.now() - new Date(last.CreatedAt).getTime()) / (60 * 60 * 1000) : null;
  const healthy = !!last && last.Status === "success" && ageHours !== null && ageHours <= BACKUP_MAX_AGE_HOURS;
  const rawScore = healthy ? 100 : 0;

  let summary: string;
  if (!last) summary = "No database backup has ever run.";
  else if (last.Status !== "success") summary = `Most recent backup (${last.CreatedAt}) failed.`;
  else if (ageHours !== null && ageHours > BACKUP_MAX_AGE_HOURS) summary = `Most recent successful backup was ${Math.round(ageHours / 24)} day(s) ago.`;
  else summary = `Most recent backup (${last.CreatedAt}) succeeded within the last ${BACKUP_MAX_AGE_HOURS} hours.`;

  return {
    key: "backups",
    label: "Backup Status",
    weight: CATEGORY_WEIGHTS.backups,
    rawScore,
    points: toPoints(rawScore, CATEGORY_WEIGHTS.backups),
    summary,
    failingEntities: healthy || !last ? [] : [{ id: "database-backup", name: last.FileName, detail: summary }],
  };
}

function buildRecommendation(category: CategoryScore): Recommendation | null {
  const gain = category.weight - category.points;
  if (gain <= 0) return null;
  const n = category.failingEntities.length;
  switch (category.key) {
    case "patching":
      return { action: `Patch ${n} device(s) to gain ${gain} point(s).`, pointGain: gain };
    case "alerts":
      return { action: `Resolve the open critical/high alerts to gain ${gain} point(s).`, pointGain: gain };
    case "endpointProtection":
      return { action: `Fix firewall/antivirus on ${n} device(s) to gain ${gain} point(s).`, pointGain: gain };
    case "accountHygiene":
      return { action: `Enable 2FA or rotate the password for ${n} account(s) to gain ${gain} point(s).`, pointGain: gain };
    case "backups":
      return { action: `Get the database backup running successfully to gain ${gain} point(s).`, pointGain: gain };
  }
}

// Raw open-finding counts by severity, kept separate from scoring - still used by
// src/lib/securityCenter/overview.ts to render its per-module "Vulnerabilities" / "Malware
// Detections" / "Intrusion Alerts" severity cards, which are a legitimate, independent display
// of what each module currently has open and aren't part of the weighted score above.
export interface ComponentCounts {
  vulnerabilities: Record<string, number>;
  malware: Record<string, number>;
  intrusionAlerts: Record<string, number>;
}

export async function getComponentCounts(): Promise<ComponentCounts> {
  const db = await getDb();

  const vulnResult = await db.query<{ Severity: string; Cnt: number }>(
    "SELECT Severity, COUNT(*) AS Cnt FROM VulnerabilityFindings WHERE Status IN ('Open','Confirmed') GROUP BY Severity"
  );
  const malwareResult = await db.query<{ Severity: string; Cnt: number }>(
    "SELECT Severity, COUNT(*) AS Cnt FROM MalwareFindings WHERE Status = 'Open' GROUP BY Severity"
  );
  const alertResult = await db.query<{ Severity: string; Cnt: number }>(
    "SELECT Severity, COUNT(*) AS Cnt FROM SecurityAlerts WHERE Status NOT IN ('Resolved', 'FalsePositive', 'Suppressed') GROUP BY Severity"
  );

  const toRecord = (rows: { Severity: string; Cnt: number }[]) => Object.fromEntries(rows.map((r) => [r.Severity, r.Cnt]));

  return {
    vulnerabilities: toRecord(vulnResult.recordset),
    malware: toRecord(malwareResult.recordset),
    intrusionAlerts: toRecord(alertResult.recordset),
  };
}

export async function computeWeightedSecurityScore(): Promise<SecurityScoreResult> {
  const categories = await Promise.all([scorePatching(), scoreAlerts(), scoreEndpointProtection(), scoreAccountHygiene(), scoreBackups()]);
  const overallScore = Math.max(0, Math.min(100, Math.round(categories.reduce((sum, c) => sum + c.points, 0))));
  const recommendations = categories
    .map(buildRecommendation)
    .filter((r): r is Recommendation => r !== null)
    .sort((a, b) => b.pointGain - a.pointGain);

  return { overallScore, riskLevel: riskLevelForScore(overallScore), categories, recommendations };
}
