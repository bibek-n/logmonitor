import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { ALERT_STATUSES, type AlertStatus } from "@/lib/intrusionDetection/shared";

// Status changes require security_analyst (an analyst investigates and updates status day
// to day); only rule/allowlist/blocklist changes are reserved for security_admin.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_analyst");
  if (!isSecuritySession(session)) return session;

  const { id } = await params;
  const alertId = Number(id);
  if (!Number.isInteger(alertId) || alertId <= 0) return NextResponse.json({ ok: false, error: "Invalid alert id." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const newStatus = body?.status as AlertStatus | undefined;
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;

  if (!newStatus || !ALERT_STATUSES.includes(newStatus)) {
    return NextResponse.json({ ok: false, error: `Status must be one of: ${ALERT_STATUSES.join(", ")}` }, { status: 400 });
  }

  const db = await getDb();
  const current = await db.request().input("id", sql.Int, alertId).query<{ Status: string }>(`SELECT Status FROM SecurityAlerts WHERE Id = @id`);
  if (!current.recordset[0]) return NextResponse.json({ ok: false, error: "Alert not found." }, { status: 404 });

  const oldStatus = current.recordset[0].Status;

  await db
    .request()
    .input("id", sql.Int, alertId)
    .input("status", sql.VarChar, newStatus)
    .query(`UPDATE SecurityAlerts SET Status = @status, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id`);

  await db
    .request()
    .input("alertId", sql.Int, alertId)
    .input("oldStatus", sql.VarChar, oldStatus)
    .input("newStatus", sql.VarChar, newStatus)
    .input("userId", sql.Int, session.userId)
    .input("username", sql.NVarChar, session.username)
    .input("reason", sql.NVarChar, reason)
    .query(`
      INSERT INTO SecurityAlertStatusHistory (AlertId, OldStatus, NewStatus, ChangedByUserId, ChangedByUsername, Reason)
      VALUES (@alertId, @oldStatus, @newStatus, @userId, @username, @reason)
    `);

  await logAdminAction({ admin: session, section: "intrusion-detection", action: "alert_status_change", details: `Alert #${alertId}: ${oldStatus} -> ${newStatus}`, req });

  return NextResponse.json({ ok: true });
}
