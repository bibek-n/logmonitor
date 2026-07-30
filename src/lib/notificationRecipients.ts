import { getDb, sql } from "./db";

export interface NotificationModuleDef {
  moduleKey: string;
  subModuleKey: string; // "" for a module with only one notification type
  moduleLabel: string;
  subModuleLabel: string | null;
}

// The fixed, known set of module/sub-module notification routes this app supports today -
// each one used to decide its own recipients via a hardcoded array, a hardcoded string, or an
// env var with a hardcoded fallback (all three patterns baked in support@websearchpro.net).
// This is the single source of truth for both the Settings > Notifications UI and
// getModuleRecipients() below - adding a new module elsewhere in the app means adding one
// entry here plus one seed row in migrate-notification-recipients.ts.
export const NOTIFICATION_MODULES: NotificationModuleDef[] = [
  { moduleKey: "intrusion-detection", subModuleKey: "", moduleLabel: "Intrusion Detection", subModuleLabel: null },
  { moduleKey: "sql-monitoring", subModuleKey: "instance-down", moduleLabel: "SQL Server Monitoring", subModuleLabel: "Instance Down" },
  { moduleKey: "sql-monitoring", subModuleKey: "instance-recovered", moduleLabel: "SQL Server Monitoring", subModuleLabel: "Instance Recovered" },
  { moduleKey: "website-audit", subModuleKey: "scan-complete", moduleLabel: "Website Security Audit", subModuleLabel: "Scan Complete" },
  { moduleKey: "website-performance", subModuleKey: "threshold-breach", moduleLabel: "Website Speed & Performance", subModuleLabel: "Threshold Breach" },
];

// A "system" row is one this app's own code actually looks up (via getModuleRecipients,
// called from a real trigger like an IDS alert or a failed SQL Server ping) - its
// ModuleKey/SubModuleKey can't be renamed or deleted from Settings without breaking that
// trigger. An admin can freely add/remove any number of additional "custom" rows on top -
// they're not wired to any code path automatically, but they let one keep a single place to
// manage "who gets emailed about what" even for notification types this app hasn't wired up
// yet, or as a general-purpose module/recipient address book.
export function isSystemModule(moduleKey: string, subModuleKey: string): boolean {
  return NOTIFICATION_MODULES.some((m) => m.moduleKey === moduleKey && m.subModuleKey === subModuleKey);
}

// Turns a free-typed module/sub-module name into a short, DB-safe, URL-ish key. Not
// guaranteed unique on its own - callers (the recipients POST route) must still check for a
// collision against existing rows before inserting.
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// Returns a comma-joined recipient string ready to pass straight into sendNotificationEmail's
// `to` field (it already splits on commas into one RCPT TO per address), or null if this
// module/sub-module is disabled, has no recipients configured, or the table itself isn't
// reachable - callers should treat null as "don't send" rather than fall back to any
// hardcoded address of their own.
export async function getModuleRecipients(moduleKey: string, subModuleKey = ""): Promise<string | null> {
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input("moduleKey", sql.VarChar, moduleKey)
      .input("subModuleKey", sql.VarChar, subModuleKey)
      .query<{ Recipients: string; Enabled: boolean }>(
        "SELECT Recipients, Enabled FROM NotificationRecipients WHERE ModuleKey = @moduleKey AND SubModuleKey = @subModuleKey"
      );
    const row = result.recordset[0];
    if (!row || !row.Enabled) return null;

    const recipients = row.Recipients.split(",").map((r) => r.trim()).filter(Boolean);
    return recipients.length > 0 ? recipients.join(", ") : null;
  } catch (err) {
    console.error(`[notificationRecipients] failed to look up recipients for ${moduleKey}/${subModuleKey}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
