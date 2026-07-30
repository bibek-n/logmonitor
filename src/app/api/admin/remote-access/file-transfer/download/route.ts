import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { logAdminAction } from "@/lib/adminAudit";
import { writeAuditEvent } from "@/lib/remoteAccess/auditLog";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { downloadFileViaSftp } from "@/lib/remoteAccess/connectionService";
import { getDb, sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_file_download");
  if (!isRemoteAccessSession(ra)) return ra;

  const connectionId = Number(req.nextUrl.searchParams.get("connectionId"));
  const remotePath = req.nextUrl.searchParams.get("path");
  if (!connectionId || !remotePath) return NextResponse.json({ ok: false, error: "connectionId and path are required" }, { status: 400 });

  const tempPath = path.join(os.tmpdir(), `logmonitor-ra-download-${crypto.randomBytes(8).toString("hex")}`);
  try {
    await downloadFileViaSftp(connectionId, remotePath, tempPath);
    const buffer = await fs.readFile(tempPath);

    const db = await getDb();
    await db
      .request()
      .input("connectionId", sql.Int, connectionId)
      .input("remotePath", sql.NVarChar, remotePath)
      .input("sizeBytes", sql.BigInt, buffer.length)
      .input("userId", sql.Int, ra.userId)
      .query(`
        INSERT INTO RemoteFileTransfers (ConnectionId, Direction, RemotePath, SizeBytes, StartedByUserId, CreatedByUserId, UpdatedByUserId)
        VALUES (@connectionId, 'Download', @remotePath, @sizeBytes, @userId, @userId, @userId)
      `);
    await writeAuditEvent({ eventType: "FileDownloaded", userId: ra.userId, username: ra.username, connectionId, action: remotePath, result: "Success" });
    await logAdminAction({ admin: ra, section: "remote-access", action: "file_download", details: `${remotePath} (${buffer.length} bytes)`, req });

    const filename = remotePath.split("/").pop() || "download";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${filename}"` },
    });
  } catch (err) {
    await writeAuditEvent({ eventType: "FileDownloaded", userId: ra.userId, username: ra.username, connectionId, action: remotePath, result: "Failure", failureReason: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Download failed" }, { status: 400 });
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => {});
  }
}
