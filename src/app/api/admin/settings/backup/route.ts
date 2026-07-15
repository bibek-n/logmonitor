import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import mssql from "mssql";
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

  // SQL Server's BACKUP DATABASE writes on the database server's own filesystem — since
  // this app's SQL Server instance runs locally (DB_SERVER=localhost), the same path is
  // reachable from Node afterward to read the resulting file size.
  //
  // mssql/tedious defaults every request to a 15s timeout, confirmed live as the actual
  // cause of every prior failed backup ("Timeout: Request failed to complete in 15000ms") -
  // not a permissions issue. BACKUP DATABASE on a real production database routinely runs
  // past that. Setting `.timeout` on a Request object does NOT work in this mssql version -
  // traced into node_modules/mssql/lib/tedious/request.js and confirmed it constructs the
  // underlying tedious Request as `new tds.Request(command, callback)` with no options
  // object, so a per-request timeout is silently never forwarded. The only way that
  // actually takes effect is a pool-level `requestTimeout`, so this opens its own temporary
  // connection with a long timeout instead of reusing the shared low-timeout pool - keeping
  // every other query in the app fast-failing at the normal default.
  let backupPool: mssql.ConnectionPool | null = null;
  try {
    backupPool = await new mssql.ConnectionPool({
      server: process.env.DB_SERVER!,
      database: process.env.DB_DATABASE!,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      options: { trustServerCertificate: true, encrypt: false },
      requestTimeout: 10 * 60 * 1000,
      connectionTimeout: 30000,
    }).connect();

    await backupPool
      .request()
      .input("filePath", sql.NVarChar, filePath)
      .query(`BACKUP DATABASE [${dbName.replace(/]/g, "]]")}] TO DISK = @filePath WITH INIT, COMPRESSION`);
    const stat = await fs.stat(filePath);
    sizeBytes = stat.size;
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    await backupPool?.close().catch(() => {});
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
