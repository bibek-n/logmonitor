import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

const BACKUP_DIR = path.join(process.cwd(), "backups");

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const dbName = process.env.DB_DATABASE;
  if (!dbName) {
    return NextResponse.json({ ok: false, error: "DB_DATABASE is not configured." }, { status: 500 });
  }

  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${dbName}_${stamp}.bak`;
  const filePath = path.join(BACKUP_DIR, fileName);

  const db = await getDb();
  let status: "success" | "failed" = "success";
  let errorMessage: string | null = null;
  let sizeBytes: number | null = null;

  try {
    // SQL Server's BACKUP DATABASE writes on the database server's own filesystem — since
    // this app's SQL Server instance runs locally (DB_SERVER=localhost), the same path is
    // reachable from Node afterward to read the resulting file size.
    await db
      .request()
      .input("filePath", sql.NVarChar, filePath)
      .query(`BACKUP DATABASE [${dbName.replace(/]/g, "]]")}] TO DISK = @filePath WITH INIT, COMPRESSION`);
    const stat = await fs.stat(filePath);
    sizeBytes = stat.size;
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  await db
    .request()
    .input("fileName", sql.NVarChar, fileName)
    .input("filePath", sql.NVarChar, filePath)
    .input("sizeBytes", sql.BigInt, sizeBytes)
    .input("status", sql.VarChar, status)
    .input("errorMessage", sql.NVarChar, errorMessage)
    .input("triggeredByUserId", sql.Int, admin.userId)
    .input("triggeredByUsername", sql.NVarChar, admin.username)
    .query(`
      INSERT INTO BackupHistory (FileName, FilePath, SizeBytes, Status, ErrorMessage, TriggeredByUserId, TriggeredByUsername)
      VALUES (@fileName, @filePath, @sizeBytes, @status, @errorMessage, @triggeredByUserId, @triggeredByUsername)
    `);

  await logAdminAction({ admin, section: "backup_data", action: "run_backup", details: `status=${status}`, req });

  if (status === "failed") {
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
  return NextResponse.json({ ok: true, fileName, sizeBytes });
}
