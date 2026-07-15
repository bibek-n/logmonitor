import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { resolveDeviceChat } from "@/lib/employeeChatAuth";

// Polled by the chat companion (agent/chattray) alongside its existing chat-unread poll —
// same low-privilege ChatToken auth, same reasoning (see chat-unread/route.ts): only a
// process in the user's own desktop session can show a toast/tray balloon, and it should
// never need the device's full API key to do it.
//
// Unlike chat-unread (a pure peek), this DOES advance a watermark (Devices.
// LastNotificationSeenId) once returned — an admin notification is a one-shot popup, not a
// persistent unread count, so it must not re-show on every 20-second poll forever.
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  const token = req.nextUrl.searchParams.get("token");
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "Missing deviceId" });
  }

  const device = await resolveDeviceChat(deviceId, token);
  if (!device) {
    return NextResponse.json({ ok: true, notifications: [] });
  }

  const db = await getDb();
  const seenResult = await db
    .request()
    .input("id", sql.Int, device.Id)
    .query<{ LastNotificationSeenId: number }>("SELECT LastNotificationSeenId FROM Devices WHERE Id = @id");
  const lastSeenId = seenResult.recordset[0]?.LastNotificationSeenId ?? 0;

  const pendingResult = await db
    .request()
    .input("staffId", sql.Int, device.StaffId)
    .input("lastSeenId", sql.Int, lastSeenId)
    .query<{ Id: number; Message: string }>(`
      SELECT Id, Message FROM EmployeeNotifications
      WHERE (StaffId = @staffId OR StaffId IS NULL) AND Id > @lastSeenId
      ORDER BY Id ASC
    `);

  if (pendingResult.recordset.length > 0) {
    const maxId = pendingResult.recordset[pendingResult.recordset.length - 1].Id;
    await db.request().input("id", sql.Int, device.Id).input("maxId", sql.Int, maxId).query(
      "UPDATE Devices SET LastNotificationSeenId = @maxId WHERE Id = @id"
    );
  }

  return NextResponse.json({
    ok: true,
    notifications: pendingResult.recordset.map((r) => ({ id: r.Id, message: r.Message })),
  });
}
