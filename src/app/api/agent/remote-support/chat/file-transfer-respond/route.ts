import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { resolveDeviceChat } from "@/lib/employeeChatAuth";

interface FileTransferRow {
  Id: number;
  SessionId: number;
  DeviceId: string;
  Status: string;
}

// The employee's explicit per-file approval gate, shown on the consent tab alongside the
// active-session view - a file transfer can be queued by an admin (see the admin-side
// file-transfers POST route) but nothing moves until this returns approved:true.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const token = typeof body?.token === "string" ? body.token : null;
  const transferId = Number(body?.transferId);
  const approved = body?.approved === true;

  const device = await resolveDeviceChat(deviceId, token);
  if (!device) return NextResponse.json({ ok: false, error: "Unauthorized" });
  if (!Number.isInteger(transferId) || transferId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid transfer id" });
  }

  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, transferId)
    .query<FileTransferRow>(`
      SELECT ft.Id, ft.SessionId, rss.DeviceId, ft.Status
      FROM RemoteSessionFileTransfers ft
      JOIN RemoteSupportSessions rss ON rss.Id = ft.SessionId
      WHERE ft.Id = @id
    `);
  const row = result.recordset[0];
  if (!row || row.DeviceId !== deviceId) {
    return NextResponse.json({ ok: false, error: "Transfer not found" });
  }
  if (row.Status !== "PendingApproval") {
    return NextResponse.json({ ok: false, error: "Transfer is no longer pending approval" });
  }

  const newStatus = approved ? "Approved" : "Rejected";
  await db
    .request()
    .input("id", sql.Int, transferId)
    .input("status", sql.VarChar, newStatus)
    .query(`
      UPDATE RemoteSessionFileTransfers SET Status = @status, ApprovedByEmployeeAt = CASE WHEN @status = 'Approved' THEN SYSUTCDATETIME() ELSE NULL END
      WHERE Id = @id
    `);

  await db
    .request()
    .input("sessionId", sql.Int, row.SessionId)
    .input("eventType", sql.VarChar, approved ? "FileTransferApproved" : "FileTransferRejected")
    .input("detailsJson", sql.NVarChar, JSON.stringify({ transferId }))
    .query("INSERT INTO RemoteSessionEvents (SessionId, EventType, DetailsJson) VALUES (@sessionId, @eventType, @detailsJson)");

  return NextResponse.json({ ok: true, status: newStatus });
}
