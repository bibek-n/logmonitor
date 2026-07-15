import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

const execFileAsync = promisify(execFile);
const BACKUP_DIR = path.join(process.cwd(), "backups");

// Regenerable build artifacts and the backup output folder itself - excluded so the zip
// doesn't balloon in size (node_modules/.next are easily the largest things on disk here)
// or recursively include its own past output.
const EXCLUDED_TOP_LEVEL = new Set(["node_modules", ".next", "backups", ".git"]);

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `website-backup_${stamp}.zip`;
  const filePath = path.join(BACKUP_DIR, fileName);

  const db = await getDb();
  let status: "success" | "failed" = "success";
  let errorMessage: string | null = null;
  let sizeBytes: number | null = null;

  const stagingDir = path.join(BACKUP_DIR, `.staging_${Date.now()}`);

  try {
    const root = process.cwd();
    const entries = await fs.readdir(root, { withFileTypes: true });
    const includeNames = entries.filter((e) => !EXCLUDED_TOP_LEVEL.has(e.name)).map((e) => e.name);
    if (includeNames.length === 0) {
      throw new Error("Nothing to back up - the website root appears empty.");
    }

    // Compress-Archive is all-or-nothing: confirmed live that it aborts the ENTIRE archive
    // (produces no output at all) the moment it hits even one locked file - and this app
    // always has at least one (syslog\listener.log, held open by the running syslog
    // listener process). Robocopy, unlike Compress-Archive, skips files it can't read
    // rather than aborting the whole job - so this stages a private copy first (tolerating
    // locked files, best-effort) and zips that copy instead of the live, in-use tree.
    const xd = [...EXCLUDED_TOP_LEVEL, path.basename(stagingDir)];
    await execFileAsync(
      "robocopy.exe",
      [root, stagingDir, "/E", "/R:0", "/W:0", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/XD", ...xd],
      { maxBuffer: 1024 * 1024 * 20, timeout: 10 * 60 * 1000 }
    ).catch((err) => {
      // Robocopy's own exit code convention: 0-7 = success (0=nothing to copy, 1=files
      // copied, bits for extra/mismatched files), 8+ = at least one real failure. Node
      // treats any non-zero exit as a rejection, so this reclassifies the merely-informational
      // codes rather than treating "some files were skipped" as a hard failure.
      const code = (err as { code?: number }).code;
      if (typeof code === "number" && code < 8) return;
      throw err;
    });

    const psCommand = `Compress-Archive -Path '${stagingDir.replace(/'/g, "''")}\\*' -DestinationPath '${filePath.replace(/'/g, "''")}' -CompressionLevel Optimal -Force`;
    await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psCommand], {
      maxBuffer: 1024 * 1024 * 20,
      timeout: 10 * 60 * 1000,
    });

    const stat = await fs.stat(filePath);
    sizeBytes = stat.size;
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
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
    .input("backupType", sql.VarChar, "website")
    .query(`
      INSERT INTO BackupHistory (FileName, FilePath, SizeBytes, Status, ErrorMessage, TriggeredByUserId, TriggeredByUsername, BackupType)
      VALUES (@fileName, @filePath, @sizeBytes, @status, @errorMessage, @triggeredByUserId, @triggeredByUsername, @backupType)
    `);

  await logAdminAction({ admin, section: "backup_data", action: "run_website_backup", details: `status=${status}`, req });

  if (status === "failed") {
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
  return NextResponse.json({ ok: true, fileName, sizeBytes });
}
