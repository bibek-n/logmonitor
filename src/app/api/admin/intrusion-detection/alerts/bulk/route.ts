import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";

const MAX_IDS = 200; // matches the alerts list's own PAGE_SIZE_MAX - a bulk action never covers more than one full page
const MAX_SNOOZE_MINUTES = 43200;

function parseIds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IDS) return null;
  const ids = value.map((v) => Number(v));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return null;
  return ids;
}

// One endpoint for every bulk action the Alerts list offers (acknowledge/assign/resolve/
// snooze) rather than four near-identical routes - each branch mirrors the equivalent
// single-alert route (acknowledge/assign/status/snooze) exactly, just applied to every
// selected id in one UPDATE ... OUTPUT instead of N round trips, with one bulk INSERT into
// SecurityAlertStatusHistory for whichever rows the UPDATE actually touched (OUTPUT tells us
// which, e.g. acknowledge skips rows already acknowledged).
export async function POST(req: NextRequest) {
  const session = await requireSecurityRole("security_analyst");
  if (!isSecuritySession(session)) return session;

  const body = await req.json().catch(() => null);
  const ids = parseIds(body?.ids);
  if (!ids) return NextResponse.json({ ok: false, error: `ids must be a non-empty array of up to ${MAX_IDS} positive integers.` }, { status: 400 });
  const idList = ids.join(",");

  const db = await getDb();
  let affected = 0;

  if (body?.action === "acknowledge") {
    const result = await db
      .request()
      .input("userId", sql.Int, session.userId)
      .query<{ Id: number; OldStatus: string; NewStatus: string }>(`
        UPDATE SecurityAlerts
        SET AcknowledgedAt = SYSUTCDATETIME(), AcknowledgedByUserId = @userId,
          Status = CASE WHEN Status = 'New' THEN 'Acknowledged' ELSE Status END, UpdatedAt = SYSUTCDATETIME()
        OUTPUT INSERTED.Id, DELETED.Status AS OldStatus, INSERTED.Status AS NewStatus
        WHERE Id IN (${idList}) AND AcknowledgedAt IS NULL
      `);
    affected = result.recordset.length;
    if (affected > 0) {
      const values = result.recordset.map((r) => `(${r.Id}, '${r.OldStatus}', '${r.NewStatus}', @userId, @username, 'Bulk acknowledge')`).join(",");
      await db.request().input("userId", sql.Int, session.userId).input("username", sql.NVarChar, session.username).query(`
        INSERT INTO SecurityAlertStatusHistory (AlertId, OldStatus, NewStatus, ChangedByUserId, ChangedByUsername, Reason) VALUES ${values}
      `);
    }
  } else if (body?.action === "assign") {
    const userId = body?.userId === null ? null : Number(body?.userId);
    if (userId !== null && (!Number.isInteger(userId) || userId <= 0)) {
      return NextResponse.json({ ok: false, error: "userId must be an integer or null." }, { status: 400 });
    }
    let assigneeUsername: string | null = null;
    if (userId !== null) {
      const user = await db.request().input("userId", sql.Int, userId).query<{ Username: string }>(`SELECT Username FROM Users WHERE Id = @userId`);
      if (!user.recordset[0]) return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
      assigneeUsername = user.recordset[0].Username;
    }
    const result = await db.request().input("userId", sql.Int, userId).query<{ Id: number; CurStatus: string }>(`
      UPDATE SecurityAlerts SET AssignedToUserId = @userId, UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.Id, INSERTED.Status AS CurStatus
      WHERE Id IN (${idList})
    `);
    affected = result.recordset.length;
    if (affected > 0) {
      const reason = assigneeUsername ? `Assigned to ${assigneeUsername} (bulk)` : "Unassigned (bulk)";
      const values = result.recordset.map((r) => `(${r.Id}, '${r.CurStatus}', '${r.CurStatus}', @changedByUserId, @changedByUsername, @reason)`).join(",");
      await db
        .request()
        .input("changedByUserId", sql.Int, session.userId)
        .input("changedByUsername", sql.NVarChar, session.username)
        .input("reason", sql.NVarChar, reason)
        .query(`INSERT INTO SecurityAlertStatusHistory (AlertId, OldStatus, NewStatus, ChangedByUserId, ChangedByUsername, Reason) VALUES ${values}`);
    }
  } else if (body?.action === "resolve") {
    const result = await db.request().query<{ Id: number; OldStatus: string }>(`
      UPDATE SecurityAlerts SET Status = 'Resolved', SuppressedUntil = NULL, UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.Id, DELETED.Status AS OldStatus
      WHERE Id IN (${idList}) AND Status <> 'Resolved'
    `);
    affected = result.recordset.length;
    if (affected > 0) {
      const values = result.recordset.map((r) => `(${r.Id}, '${r.OldStatus}', 'Resolved', @userId, @username, 'Bulk resolve')`).join(",");
      await db.request().input("userId", sql.Int, session.userId).input("username", sql.NVarChar, session.username).query(`
        INSERT INTO SecurityAlertStatusHistory (AlertId, OldStatus, NewStatus, ChangedByUserId, ChangedByUsername, Reason) VALUES ${values}
      `);
    }
  } else if (body?.action === "snooze") {
    const minutes = Number(body?.minutes);
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_SNOOZE_MINUTES) {
      return NextResponse.json({ ok: false, error: `minutes must be a positive integer up to ${MAX_SNOOZE_MINUTES}.` }, { status: 400 });
    }
    const result = await db.request().input("minutes", sql.Int, minutes).query<{ Id: number; OldStatus: string }>(`
      UPDATE SecurityAlerts
      SET Status = 'Suppressed', SuppressedUntil = DATEADD(MINUTE, @minutes, SYSUTCDATETIME()), UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.Id, DELETED.Status AS OldStatus
      WHERE Id IN (${idList})
    `);
    affected = result.recordset.length;
    if (affected > 0) {
      const values = result.recordset.map((r) => `(${r.Id}, '${r.OldStatus}', 'Suppressed', @userId, @username, @reason)`).join(",");
      await db
        .request()
        .input("userId", sql.Int, session.userId)
        .input("username", sql.NVarChar, session.username)
        .input("reason", sql.NVarChar, `Snoozed for ${minutes} minute(s) (bulk)`)
        .query(`INSERT INTO SecurityAlertStatusHistory (AlertId, OldStatus, NewStatus, ChangedByUserId, ChangedByUsername, Reason) VALUES ${values}`);
    }
  } else {
    return NextResponse.json({ ok: false, error: "action must be one of: acknowledge, assign, resolve, snooze." }, { status: 400 });
  }

  await logAdminAction({ admin: session, section: "intrusion-detection", action: `alert_bulk_${body.action}`, details: `${affected}/${ids.length} alert(s): ${idList}`, req });

  return NextResponse.json({ ok: true, affected, requested: ids.length });
}
