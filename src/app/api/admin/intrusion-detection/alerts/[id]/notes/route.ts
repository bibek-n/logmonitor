import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_analyst");
  if (!isSecuritySession(session)) return session;

  const { id } = await params;
  const alertId = Number(id);
  if (!Number.isInteger(alertId) || alertId <= 0) return NextResponse.json({ ok: false, error: "Invalid alert id." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!note) return NextResponse.json({ ok: false, error: "Note text is required." }, { status: 400 });
  if (note.length > 4000) return NextResponse.json({ ok: false, error: "Note is too long (max 4000 characters)." }, { status: 400 });

  const db = await getDb();
  const alertCheck = await db.request().input("id", sql.Int, alertId).query<{ Id: number }>(`SELECT Id FROM SecurityAlerts WHERE Id = @id`);
  if (!alertCheck.recordset[0]) return NextResponse.json({ ok: false, error: "Alert not found." }, { status: 404 });

  await db
    .request()
    .input("alertId", sql.Int, alertId)
    .input("userId", sql.Int, session.userId)
    .input("username", sql.NVarChar, session.username)
    .input("note", sql.NVarChar, note)
    .query(`INSERT INTO SecurityAlertNotes (AlertId, UserId, Username, Note) VALUES (@alertId, @userId, @username, @note)`);

  return NextResponse.json({ ok: true });
}
