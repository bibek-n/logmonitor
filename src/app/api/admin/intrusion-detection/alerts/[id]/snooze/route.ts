import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";

const MAX_SNOOZE_MINUTES = 43200; // 30 days - generous ceiling, not a real-world duration anyone wants

// Snooze reuses the existing "Suppressed" status + SuppressedUntil column (see
// src/lib/intrusionDetection/snooze.ts for how it wakes back up) rather than adding a
// separate "Snoozed" status - functionally there's no difference between "I've suppressed
// this for now" and "I've snoozed this", and the column already existed unused.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_analyst");
  if (!isSecuritySession(session)) return session;

  const { id } = await params;
  const alertId = Number(id);
  if (!Number.isInteger(alertId) || alertId <= 0) return NextResponse.json({ ok: false, error: "Invalid alert id." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const minutes = Number(body?.minutes);
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_SNOOZE_MINUTES) {
    return NextResponse.json({ ok: false, error: `minutes must be a positive integer up to ${MAX_SNOOZE_MINUTES}.` }, { status: 400 });
  }

  const db = await getDb();
  const current = await db.request().input("id", sql.Int, alertId).query<{ Status: string }>(`SELECT Status FROM SecurityAlerts WHERE Id = @id`);
  if (!current.recordset[0]) return NextResponse.json({ ok: false, error: "Alert not found." }, { status: 404 });
  const oldStatus = current.recordset[0].Status;

  const until = await db
    .request()
    .input("id", sql.Int, alertId)
    .input("minutes", sql.Int, minutes)
    .query<{ SuppressedUntil: string }>(`
      UPDATE SecurityAlerts
      SET Status = 'Suppressed', SuppressedUntil = DATEADD(MINUTE, @minutes, SYSUTCDATETIME()), UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.SuppressedUntil
      WHERE Id = @id
    `);

  await db
    .request()
    .input("alertId", sql.Int, alertId)
    .input("oldStatus", sql.VarChar, oldStatus)
    .input("userId", sql.Int, session.userId)
    .input("username", sql.NVarChar, session.username)
    .input("reason", sql.NVarChar, `Snoozed for ${minutes} minute(s)`)
    .query(`
      INSERT INTO SecurityAlertStatusHistory (AlertId, OldStatus, NewStatus, ChangedByUserId, ChangedByUsername, Reason)
      VALUES (@alertId, @oldStatus, 'Suppressed', @userId, @username, @reason)
    `);

  await logAdminAction({ admin: session, section: "intrusion-detection", action: "alert_snooze", details: `Alert #${alertId}: snoozed ${minutes}m`, req });

  return NextResponse.json({ ok: true, suppressedUntil: until.recordset[0].SuppressedUntil });
}
