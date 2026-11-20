import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";

// Assignment is logged into SecurityAlertStatusHistory (same table the status-change route
// writes to, and the alert detail page already renders as a timeline) rather than a new
// table - OldStatus/NewStatus are both set to the alert's current status (no real status
// change happened) and the Reason text carries "Assigned to X"/"Unassigned", so the existing
// timeline UI shows ownership changes for free.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_analyst");
  if (!isSecuritySession(session)) return session;

  const { id } = await params;
  const alertId = Number(id);
  if (!Number.isInteger(alertId) || alertId <= 0) return NextResponse.json({ ok: false, error: "Invalid alert id." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const userId = body?.userId === null ? null : Number(body?.userId);
  if (userId !== null && (!Number.isInteger(userId) || userId <= 0)) {
    return NextResponse.json({ ok: false, error: "userId must be an integer or null." }, { status: 400 });
  }

  const db = await getDb();
  const current = await db.request().input("id", sql.Int, alertId).query<{ Status: string }>(`SELECT Status FROM SecurityAlerts WHERE Id = @id`);
  if (!current.recordset[0]) return NextResponse.json({ ok: false, error: "Alert not found." }, { status: 404 });
  const status = current.recordset[0].Status;

  let assigneeUsername: string | null = null;
  if (userId !== null) {
    const user = await db.request().input("userId", sql.Int, userId).query<{ Username: string }>(`SELECT Username FROM Users WHERE Id = @userId`);
    if (!user.recordset[0]) return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
    assigneeUsername = user.recordset[0].Username;
  }

  await db
    .request()
    .input("id", sql.Int, alertId)
    .input("userId", sql.Int, userId)
    .query(`UPDATE SecurityAlerts SET AssignedToUserId = @userId, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id`);

  await db
    .request()
    .input("alertId", sql.Int, alertId)
    .input("status", sql.VarChar, status)
    .input("userId", sql.Int, session.userId)
    .input("username", sql.NVarChar, session.username)
    .input("reason", sql.NVarChar, assigneeUsername ? `Assigned to ${assigneeUsername}` : "Unassigned")
    .query(`
      INSERT INTO SecurityAlertStatusHistory (AlertId, OldStatus, NewStatus, ChangedByUserId, ChangedByUsername, Reason)
      VALUES (@alertId, @status, @status, @userId, @username, @reason)
    `);

  await logAdminAction({ admin: session, section: "intrusion-detection", action: "alert_assign", details: `Alert #${alertId}: ${assigneeUsername ? `assigned to ${assigneeUsername}` : "unassigned"}`, req });

  return NextResponse.json({ ok: true });
}
