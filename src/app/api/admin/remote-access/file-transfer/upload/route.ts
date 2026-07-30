import { NextRequest, NextResponse } from "next/server";
import os from "os";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { logAdminAction } from "@/lib/adminAudit";
import { writeAuditEvent } from "@/lib/remoteAccess/auditLog";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { uploadFileViaSftp } from "@/lib/remoteAccess/connectionService";
import { getDb, sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_file_upload");
  if (!isRemoteAccessSession(ra)) return ra;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const connectionId = Number(form?.get("connectionId"));
  const remoteDir = String(form?.get("remoteDir") ?? "/");
  if (!file || !(file instanceof File) || !connectionId) {
    return NextResponse.json({ ok: false, error: "file and connectionId are required" }, { status: 400 });
  }

  // Local temp filename is never derived from user input (the uploaded file's own name is only
  // ever used for the REMOTE path, joined server-side with a fixed remoteDir) - this is the
  // local-path-traversal guard for the temp-file handoff step.
  const tempPath = path.join(os.tmpdir(), `logmonitor-ra-upload-${crypto.randomBytes(8).toString("hex")}`);
  const remotePath = `${remoteDir.replace(/\/+$/, "")}/${file.name}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempPath, buffer);
    await uploadFileViaSftp(connectionId, tempPath, remotePath);

    const db = await getDb();
    await db
      .request()
      .input("connectionId", sql.Int, connectionId)
      .input("remotePath", sql.NVarChar, remotePath)
      .input("sizeBytes", sql.BigInt, buffer.length)
      .input("userId", sql.Int, ra.userId)
      .query(`
        INSERT INTO RemoteFileTransfers (ConnectionId, Direction, RemotePath, SizeBytes, StartedByUserId, CreatedByUserId, UpdatedByUserId)
        VALUES (@connectionId, 'Upload', @remotePath, @sizeBytes, @userId, @userId, @userId)
      `);

    await writeAuditEvent({ eventType: "FileUploaded", userId: ra.userId, username: ra.username, connectionId, action: remotePath, result: "Success" });
    await logAdminAction({ admin: ra, section: "remote-access", action: "file_upload", details: `${remotePath} (${buffer.length} bytes)`, req });

    return NextResponse.json({ ok: true, data: { remotePath, sizeBytes: buffer.length } });
  } catch (err) {
    await writeAuditEvent({ eventType: "FileUploaded", userId: ra.userId, username: ra.username, connectionId, action: remotePath, result: "Failure", failureReason: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Upload failed" }, { status: 400 });
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => {});
  }
}
