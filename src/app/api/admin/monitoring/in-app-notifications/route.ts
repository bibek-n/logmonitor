import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getDb, sql } from "@/lib/db";

// Deliberately NOT gated by requireMonitoringPermission()/mon_view - an in-app alert
// notification is delivered to whichever Username an AlertContact names, and that admin may
// not hold any mon_* permission at all (e.g. a manager who just wants to be pinged when the
// public site goes down). Any authenticated dashboard user can read their own feed; there is no
// cross-user access here since every query is scoped to the caller's own UserId.
async function currentUserId(): Promise<number | null> {
  const session = await getServerSession(authOptions);
  const username = session?.user?.name;
  if (!username) return null;
  const db = await getDb();
  const row = await db.request().input("username", sql.NVarChar, username).query<{ Id: number }>("SELECT Id FROM Users WHERE Username = @username");
  return row.recordset[0]?.Id ?? null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const db = await getDb();
  const result = await db.request().input("userId", sql.Int, userId).query(`
    SELECT TOP 50 Id, EventType, Subject, Body, MonitorId, IncidentId, IsRead, CONVERT(VARCHAR(33), CreatedAt, 126) AS CreatedAt
    FROM InAppNotifications
    WHERE UserId = @userId
    ORDER BY CreatedAt DESC
  `);
  const unread = await db.request().input("userId", sql.Int, userId).query<{ Count: number }>("SELECT COUNT(*) AS Count FROM InAppNotifications WHERE UserId = @userId AND IsRead = 0");

  return NextResponse.json({ ok: true, data: result.recordset, unreadCount: unread.recordset[0].Count });
}

// Marks every one of the caller's own notifications as read (a simple "mark all read" - the
// bell dropdown doesn't need per-item read state for this feature's scope).
export async function POST(_req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const db = await getDb();
  await db.request().input("userId", sql.Int, userId).query("UPDATE InAppNotifications SET IsRead = 1 WHERE UserId = @userId AND IsRead = 0");

  return NextResponse.json({ ok: true });
}
