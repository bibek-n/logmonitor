import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireRemoteSupportPermission, isRemoteSupportSession } from "@/lib/requireRemoteSupportPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { getSessionById } from "@/lib/remoteSupport/sessionAuthorization";

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200MB - generous but bounded

// Only queues the transfer as PendingApproval - nothing is sent until the employee explicitly
// approves via the agent-side respond endpoint (session_events records both the request and
// the employee's decision, per the audit requirements).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rs = await requireRemoteSupportPermission("remote_support_file_transfer");
  if (!isRemoteSupportSession(rs)) return rs;

  const { id: idParam } = await params;
  const sessionId = Number(idParam);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid session id" }, { status: 400 });
  }

  const session = await getSessionById(sessionId);
  if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
  if (session.RequestedByUserId !== rs.userId && rs.role !== "Admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (session.Status !== "Active") {
    return NextResponse.json({ ok: false, error: "Session is not active" }, { status: 409 });
  }
  if (!session.PermissionsGranted.split(",").includes("file_transfer")) {
    return NextResponse.json({ ok: false, error: "File transfer was not granted for this session" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const fileName = typeof body?.fileName === "string" ? body.fileName.slice(0, 260) : "";
  const sizeBytes = Number(body?.sizeBytes);
  const direction = body?.direction === "EmployeeToAdmin" ? "EmployeeToAdmin" : "AdminToEmployee";

  if (!fileName || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ ok: false, error: "fileName and a positive sizeBytes are required" }, { status: 400 });
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ ok: false, error: "File is too large" }, { status: 400 });
  }

  const db = await getDb();
  const insertResult = await db
    .request()
    .input("sessionId", sql.Int, sessionId)
    .input("direction", sql.VarChar, direction)
    .input("fileName", sql.NVarChar, fileName)
    .input("sizeBytes", sql.BigInt, sizeBytes)
    .query<{ Id: number }>(`
      INSERT INTO RemoteSessionFileTransfers (SessionId, Direction, FileName, SizeBytes)
      OUTPUT INSERTED.Id
      VALUES (@sessionId, @direction, @fileName, @sizeBytes)
    `);

  await logAdminAction({
    admin: rs,
    section: "remote-support",
    action: "request_file_transfer",
    details: `sessionId=${sessionId} file=${fileName} direction=${direction}`,
    req,
  });

  return NextResponse.json({ ok: true, transferId: insertResult.recordset[0].Id });
}
