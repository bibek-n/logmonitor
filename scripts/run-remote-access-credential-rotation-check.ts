import "dotenv/config";
import { getDb } from "../src/lib/db";
import { writeAuditEvent } from "../src/lib/remoteAccess/auditLog";

// Scheduled credential-rotation reminder (Phase 3). Never touches the encrypted secret itself -
// only reads RotationReminderDays/LastRotatedAt/Name to decide what's due, and records a single
// audit-log summary event so a rotation-due backlog is visible in Connection Logs even if nobody
// opens the Credentials Vault page for a while.
async function main() {
  const db = await getDb();
  const result = await db.query<{ Id: number; Name: string; LastRotatedAt: Date | null; CreatedAt: Date; RotationReminderDays: number | null }>(`
    SELECT Id, Name, LastRotatedAt, CreatedAt, RotationReminderDays
    FROM RemoteCredentials
    WHERE IsDeleted = 0 AND IsActive = 1 AND RotationReminderDays IS NOT NULL
  `);

  const due: string[] = [];
  const now = Date.now();
  for (const row of result.recordset) {
    const base = (row.LastRotatedAt ?? row.CreatedAt).getTime();
    const dueAt = base + row.RotationReminderDays! * 86400000;
    if (dueAt <= now) due.push(row.Name);
  }

  console.log(`Remote Access Credential Rotation Check: ${due.length} credential(s) due for rotation.`);

  if (due.length > 0) {
    await writeAuditEvent({
      eventType: "CredentialUsed",
      userId: null,
      username: "scheduled-task",
      action: `Rotation due: ${due.slice(0, 20).join(", ")}${due.length > 20 ? ` (+${due.length - 20} more)` : ""}`,
      result: "Success",
    });
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
