import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { resolveDeviceChat } from "@/lib/employeeChatAuth";

// Public route — no NextAuth session (the employee has no dashboard login). Authorization
// is the high-entropy ChatToken generated at enrollment (agentAuth.ts's generateChatToken)
// instead — see resolveDeviceChat in employeeChatAuth.ts, shared with the chat page itself.
// Always responds 200 (even on logical failure, via `ok: false`) — this app's IIS front end
// replaces any non-2xx response body with a generic HTML error page, which would otherwise
// hand the polling browser's `res.json()` an HTML document instead of the intended error
// payload (same fix already applied to the agent enroll/heartbeat routes).

export async function GET(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  const token = req.nextUrl.searchParams.get("token");

  const device = await resolveDeviceChat(deviceId, token);
  if (!device) return NextResponse.json({ ok: false, error: "Chat not available" });

  const db = await getDb();
  const messagesResult = await db
    .request()
    .input("staffId", sql.Int, device.StaffId)
    .query<{ Id: number; SenderType: string; SenderName: string; Message: string; CreatedAt: string }>(
      "SELECT Id, SenderType, SenderName, Message, CreatedAt FROM ChatMessages WHERE StaffId = @staffId ORDER BY CreatedAt ASC, Id ASC"
    );

  await db
    .request()
    .input("staffId", sql.Int, device.StaffId)
    .query("UPDATE ChatMessages SET ReadByEmployeeAt = SYSUTCDATETIME() WHERE StaffId = @staffId AND SenderType = 'admin' AND ReadByEmployeeAt IS NULL");

  return NextResponse.json({ ok: true, staffName: device.StaffName, messages: messagesResult.recordset });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  const token = req.nextUrl.searchParams.get("token");

  const device = await resolveDeviceChat(deviceId, token);
  if (!device) return NextResponse.json({ ok: false, error: "Chat not available" });

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ ok: false, error: "Message is required" });
  if (message.length > 4000) return NextResponse.json({ ok: false, error: "Message is too long" });

  const db = await getDb();
  await db
    .request()
    .input("staffId", sql.Int, device.StaffId)
    .input("deviceId", sql.Int, device.Id)
    .input("senderName", sql.NVarChar, device.StaffName)
    .input("message", sql.NVarChar, message)
    .query(
      "INSERT INTO ChatMessages (StaffId, DeviceId, SenderType, SenderName, Message, ReadByEmployeeAt) VALUES (@staffId, @deviceId, 'employee', @senderName, @message, SYSUTCDATETIME())"
    );

  return NextResponse.json({ ok: true });
}
