import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { resolveDeviceChat } from "@/lib/employeeChatAuth";

// Polled independently by the chat companion (a separate process from the main agent
// service — see agent/chattray — since only a process in the user's own desktop session
// can show a tray icon/notification). Deliberately authenticated with the low-privilege
// ChatToken (same as the public employee chat route), NOT the device's full API key — the
// companion's on-disk config only ever needs to hold this one narrow-scope token, never the
// device credential used for telemetry. A pure peek: never marks anything as read, so the
// unread badge stays accurate until the employee actually opens the chat page.
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  const token = req.nextUrl.searchParams.get("token");
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "Missing deviceId" });
  }

  const device = await resolveDeviceChat(deviceId, token);
  if (!device) {
    return NextResponse.json({ ok: true, chatAvailable: false, unreadCount: 0 });
  }

  const db = await getDb();
  const unreadResult = await db
    .request()
    .input("staffId", sql.Int, device.StaffId)
    .query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM ChatMessages WHERE StaffId = @staffId AND SenderType = 'admin' AND ReadByEmployeeAt IS NULL");

  return NextResponse.json({ ok: true, chatAvailable: true, unreadCount: unreadResult.recordset[0]?.Cnt ?? 0 });
}
