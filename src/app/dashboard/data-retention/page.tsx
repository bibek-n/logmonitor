import { getDb } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { DataRetentionClient, type RetentionRow } from "@/components/settings/DataRetentionClient";

export const dynamic = "force-dynamic";

// A single read-only overview of every per-module data-retention setting in the app, each of
// which already has its own working settings form elsewhere (Code Quality, Laravel Security,
// Website & API Monitoring, WAF Gateway, Wazuh Office, Employee Activity Monitoring, Browser
// Activity, Backup & Data) - this page doesn't duplicate those forms, it just answers "how long
// do we keep what" in one place instead of hunting across eight separate settings pages, with a
// link to the real editor for whichever one needs changing.
export default async function DataRetentionPage() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const [cq, ls, mon, waf, wo, aa, ba, backup] = await Promise.all([
    db.query<{ RetentionDays: number | null }>("SELECT RetentionDays FROM CodeQualitySettings WHERE Id = 1"),
    db.query<{ RetentionDays: number | null }>("SELECT RetentionDays FROM LaravelSecuritySettings WHERE Id = 1"),
    db.query<{ DataRetentionDays: number | null }>("SELECT DataRetentionDays FROM MonitoringSettings WHERE Id = 1"),
    db.query<{ AttackEventRetentionDays: number | null; RequestLogRetentionDays: number | null }>(
      "SELECT AttackEventRetentionDays, RequestLogRetentionDays FROM WafSettings WHERE Id = 1"
    ),
    db.query<{ SecurityEventRetentionDays: number | null; AlertRetentionDays: number | null; MetricRetentionDays: number | null }>(
      "SELECT SecurityEventRetentionDays, AlertRetentionDays, MetricRetentionDays FROM WazuhOfficeSettings WHERE Id = 1"
    ),
    db.query<{ RetentionDays: number | null }>("SELECT RetentionDays FROM AppActivitySettings WHERE Id = 1"),
    db.query<{ RetentionDays: number | null }>("SELECT RetentionDays FROM BrowserActivitySettings WHERE Id = 1"),
    db.query<{ RetentionPolicyDays: number | null; BackupRetentionCount: number | null }>(
      "SELECT RetentionPolicyDays, BackupRetentionCount FROM CompanySettings WHERE Id = 1"
    ),
  ]);

  const rows: RetentionRow[] = [
    { module: "Code Quality", setting: "Scan history", days: cq.recordset[0]?.RetentionDays ?? null, href: "/dashboard/code-quality/settings" },
    { module: "Laravel Security", setting: "Scan history", days: ls.recordset[0]?.RetentionDays ?? null, href: "/dashboard/laravel-security/settings" },
    { module: "Website & API Monitoring", setting: "Check history", days: mon.recordset[0]?.DataRetentionDays ?? null, href: "/dashboard/monitoring/settings" },
    { module: "WAF Gateway", setting: "Attack events", days: waf.recordset[0]?.AttackEventRetentionDays ?? null, href: "/dashboard/waf/settings" },
    { module: "WAF Gateway", setting: "Request logs", days: waf.recordset[0]?.RequestLogRetentionDays ?? null, href: "/dashboard/waf/settings" },
    { module: "Wazuh Office", setting: "Security events", days: wo.recordset[0]?.SecurityEventRetentionDays ?? null, href: "/dashboard/wazuh-office/settings" },
    { module: "Wazuh Office", setting: "Alerts", days: wo.recordset[0]?.AlertRetentionDays ?? null, href: "/dashboard/wazuh-office/settings" },
    { module: "Wazuh Office", setting: "Metrics", days: wo.recordset[0]?.MetricRetentionDays ?? null, href: "/dashboard/wazuh-office/settings" },
    { module: "Employee Activity Monitoring", setting: "Session history", days: aa.recordset[0]?.RetentionDays ?? null, href: "/dashboard/app-activity/settings" },
    { module: "Browser Activity Audit", setting: "Browsing history", days: ba.recordset[0]?.RetentionDays ?? null, href: "/dashboard/browser-activity/settings" },
    { module: "Backup & Data", setting: "Backup files kept (days)", days: backup.recordset[0]?.RetentionPolicyDays ?? null, href: "/dashboard/settings?section=backup-and-data" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Data Retention Overview</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        How long each module keeps its data before automatic cleanup. Every row is editable from that module&apos;s own settings page — this is a
        single place to see them all together, not a separate set of controls.
      </p>
      <DataRetentionClient rows={rows} />
    </div>
  );
}
