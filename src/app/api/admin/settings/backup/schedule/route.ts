import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export interface BackupScheduleData {
  BackupScheduleEnabled: boolean;
  BackupScheduleFrequency: string | null;
  BackupScheduleTime: string | null;
  BackupRetentionCount: number | null;
  RetentionPolicyDays: number | null;
  RetentionPolicyNotes: string | null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<BackupScheduleData>`
    SELECT BackupScheduleEnabled, BackupScheduleFrequency, BackupScheduleTime, BackupRetentionCount, RetentionPolicyDays, RetentionPolicyNotes
    FROM CompanySettings WHERE Id = 1
  `;
  return NextResponse.json({ ok: true, data: result.recordset[0] ?? null });
}

// Stores schedule config only — see the approved plan: automatic execution (an actual
// cron-style backup job) is explicitly phase 2.
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const int = (v: unknown) => (Number.isInteger(v) ? v : null);

  const db = await getDb();
  await db
    .request()
    .input("enabled", sql.Bit, !!body.backupScheduleEnabled)
    .input("frequency", sql.NVarChar, str(body.backupScheduleFrequency))
    .input("time", sql.NVarChar, str(body.backupScheduleTime))
    .input("retentionCount", sql.Int, int(body.backupRetentionCount))
    .input("retentionDays", sql.Int, int(body.retentionPolicyDays))
    .input("retentionNotes", sql.NVarChar, str(body.retentionPolicyNotes))
    .input("updatedByUserId", sql.Int, admin.userId)
    .query(`
      UPDATE CompanySettings SET
        BackupScheduleEnabled = @enabled, BackupScheduleFrequency = @frequency, BackupScheduleTime = @time,
        BackupRetentionCount = @retentionCount, RetentionPolicyDays = @retentionDays, RetentionPolicyNotes = @retentionNotes,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
      WHERE Id = 1
    `);

  await logAdminAction({ admin, section: "backup_data", action: "update_backup_schedule", req });

  return NextResponse.json({ ok: true });
}
