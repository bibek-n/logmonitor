import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { resolveDeviceChat } from "@/lib/employeeChatAuth";

// Read-only history for the employee chat page's "Notifications" tab — deliberately
// separate from /api/agent/notifications (polled by the chat companion tray), which
// advances Devices.LastNotificationSeenId so the same popup never re-fires. This route
// never touches that watermark: the tab should keep showing everything an admin has ever
// sent, not just whatever hasn't already popped up as a toast.
export async function GET(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  const token = req.nextUrl.searchParams.get("token");

  const device = await resolveDeviceChat(deviceId, token);
  if (!device) return NextResponse.json({ ok: false, error: "Chat not available" });

  const db = await getDb();
  const result = await db
    .request()
    .input("staffId", sql.Int, device.StaffId)
    .query<{ Id: number; Message: string; CreatedAt: string }>(`
      SELECT TOP 100 Id, Message, CreatedAt FROM EmployeeNotifications
      WHERE StaffId = @staffId OR StaffId IS NULL
      ORDER BY Id DESC
    `);

  return NextResponse.json({ ok: true, notifications: result.recordset });
}
