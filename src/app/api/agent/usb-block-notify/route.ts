import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

const MAX_MESSAGE_LENGTH = 500;

// Called by the main agent (usbpolicy_windows.go) when it disables a device for matching an
// active Block entry - NOT by the chattray companion. The main agent runs as a Windows Service
// (LocalSystem, Session 0), which cannot show a toast directly on the logged-in user's desktop
// - only a process running IN that user's session can (see chattray/tray_windows.go). Rather
// than build a second delivery mechanism, this reuses the existing EmployeeNotifications queue
// that chattray already polls every ~20s and displays via tray.ShowMessage - the same channel
// the "Send Notification" admin feature uses, just written to by the agent instead of an admin.
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" });
  }

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  if (!message) {
    return NextResponse.json({ ok: false, error: "message is required" });
  }

  const db = await getDb();
  const staffResult = await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .query<{ StaffId: number | null }>("SELECT StaffId FROM Devices WHERE DeviceId = @deviceId");
  const staffId = staffResult.recordset[0]?.StaffId;

  // No linked employee (a server, or a workstation never associated with a Staff record) -
  // nothing to notify. Deliberately NOT falling back to a StaffId-IS-NULL broadcast, which
  // EmployeeNotifications treats as "show to every employee" - a single device's USB block
  // should never surface as a company-wide alert.
  if (!staffId) {
    return NextResponse.json({ ok: true, delivered: false });
  }

  await db
    .request()
    .input("staffId", sql.Int, staffId)
    .input("message", sql.NVarChar, message)
    .input("sentByUsername", sql.NVarChar, "USB Device Control")
    .query("INSERT INTO EmployeeNotifications (StaffId, Message, SentByUserId, SentByUsername) VALUES (@staffId, @message, NULL, @sentByUsername)");

  return NextResponse.json({ ok: true, delivered: true });
}
