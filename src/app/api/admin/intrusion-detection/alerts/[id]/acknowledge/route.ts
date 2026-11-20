import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";

// One click for the common "I've seen this" step between New and actually investigating -
// stamps AcknowledgedAt/AcknowledgedByUserId (kept separate from Status so "time to
// acknowledge" can be measured later even if the status then skips past Acknowledged), and
// only advances Status itself when the alert is still New, so acknowledging an alert that's
// already Investigating/Confirmed/etc. doesn't regress it. Idempotent - acknowledging twice
// is a no-op on the second call.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_analyst");
  if (!isSecuritySession(session)) return session;

  const { id } = await params;
  const alertId = Number(id);
  if (!Number.isInteger(alertId) || alertId <= 0) return NextResponse.json({ ok: false, error: "Invalid alert id." }, { status: 400 });

  const db = await getDb();
  const current = await db
    .request()
    .input("id", sql.Int, alertId)
    .query<{ Status: string; AcknowledgedAt: string | null }>(`SELECT Status, AcknowledgedAt FROM SecurityAlerts WHERE Id = @id`);
  if (!current.recordset[0]) return NextResponse.json({ ok: false, error: "Alert not found." }, { status: 404 });
  if (current.recordset[0].AcknowledgedAt) return NextResponse.json({ ok: true, alreadyAcknowledged: true });

  const oldStatus = current.recordset[0].Status;
  const newStatus = oldStatus === "New" ? "Acknowledged" : oldStatus;

  await db
    .request()
    .input("id", sql.Int, alertId)
    .input("userId", sql.Int, session.userId)
    .input("status", sql.VarChar, newStatus)
    .query(`
      UPDATE SecurityAlerts
      SET AcknowledgedAt = SYSUTCDATETIME(), AcknowledgedByUserId = @userId, Status = @status, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);

  await db
    .request()
    .input("alertId", sql.Int, alertId)
    .input("oldStatus", sql.VarChar, oldStatus)
    .input("newStatus", sql.VarChar, newStatus)
    .input("userId", sql.Int, session.userId)
    .input("username", sql.NVarChar, session.username)
    .input("reason", sql.NVarChar, "Acknowledged")
    .query(`
      INSERT INTO SecurityAlertStatusHistory (AlertId, OldStatus, NewStatus, ChangedByUserId, ChangedByUsername, Reason)
      VALUES (@alertId, @oldStatus, @newStatus, @userId, @username, @reason)
    `);

  await logAdminAction({ admin: session, section: "intrusion-detection", action: "alert_acknowledge", details: `Alert #${alertId}`, req });

  return NextResponse.json({ ok: true });
}
