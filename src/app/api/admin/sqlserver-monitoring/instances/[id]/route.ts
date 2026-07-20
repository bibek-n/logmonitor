import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { encryptSqlPassword } from "@/lib/sqlServerMonitoring/credentials";

// Two independent things this route can update, either together or separately:
//  - `enabled` (boolean): the existing pause/resume toggle.
//  - `sshHost`/`sshPort`/`sshUsername`/`sshPassword`/`backupBaseDir`: the optional SSH-based
//    backup-status check (see backupStatusSsh.ts) for engines with no built-in backup catalog.
//    Passing `sshHost: null` (or omitting sshHost while it was previously set and explicitly
//    clearing) removes the SSH config entirely - all four SSH-identifying fields are cleared
//    together so a partial/broken config never lingers.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const instanceId = Number(id);
  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, instanceId).query<{ Name: string }>("SELECT Name FROM SqlServerInstances WHERE Id = @id");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Instance not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const setClauses: string[] = [];
  const request = db.request().input("id", sql.Int, instanceId);
  const actions: string[] = [];

  if (typeof body?.enabled === "boolean") {
    setClauses.push("Enabled = @enabled");
    request.input("enabled", sql.Bit, body.enabled);
    actions.push(body.enabled ? "enable_instance" : "disable_instance");
  }

  if (body?.sshHost === null) {
    // Explicit clear - remove SSH config entirely rather than leaving a partial one behind.
    setClauses.push("SshHost = NULL", "SshPort = NULL", "SshUsername = NULL", "SshPasswordEncrypted = NULL", "BackupBaseDir = NULL");
    actions.push("clear_ssh_backup_check");
  } else if (typeof body?.sshHost === "string" && body.sshHost.trim()) {
    const sshUsername = typeof body?.sshUsername === "string" ? body.sshUsername.trim() : "";
    const sshPassword = typeof body?.sshPassword === "string" ? body.sshPassword : "";
    if (!sshUsername || !sshPassword) {
      return NextResponse.json({ ok: false, error: "SSH backup check requires a host, username, and password together." }, { status: 400 });
    }
    const sshPort = typeof body?.sshPort === "number" && Number.isInteger(body.sshPort) ? body.sshPort : 22;
    const backupBaseDir = typeof body?.backupBaseDir === "string" && body.backupBaseDir.trim() ? body.backupBaseDir.trim() : null;

    setClauses.push("SshHost = @sshHost", "SshPort = @sshPort", "SshUsername = @sshUsername", "SshPasswordEncrypted = @sshPasswordEncrypted", "BackupBaseDir = @backupBaseDir");
    request
      .input("sshHost", sql.NVarChar, body.sshHost.trim())
      .input("sshPort", sql.Int, sshPort)
      .input("sshUsername", sql.NVarChar, sshUsername)
      .input("sshPasswordEncrypted", sql.NVarChar, encryptSqlPassword(sshPassword))
      .input("backupBaseDir", sql.NVarChar, backupBaseDir);
    actions.push("set_ssh_backup_check");
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ ok: false, error: "No recognized fields to update." }, { status: 400 });
  }

  await request.query(`UPDATE SqlServerInstances SET ${setClauses.join(", ")} WHERE Id = @id`);
  await logAdminAction({ admin, section: "sqlserver-monitoring", action: actions.join("+"), details: existing.recordset[0].Name, req });

  return NextResponse.json({ ok: true });
}

// Self-monitoring instance can't be removed - it's the app's own database and always needs
// to exist for the migration's seed check to stay meaningful.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const instanceId = Number(id);
  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, instanceId).query<{ Name: string; IsSelfMonitoring: boolean }>(
    "SELECT Name, IsSelfMonitoring FROM SqlServerInstances WHERE Id = @id"
  );
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Instance not found." }, { status: 404 });
  if (existing.recordset[0].IsSelfMonitoring) {
    return NextResponse.json({ ok: false, error: "The self-monitoring instance (this app's own database) can't be removed." }, { status: 400 });
  }

  await db.request().input("id", sql.Int, instanceId).query("DELETE FROM SqlServerMetricsSnapshots WHERE InstanceId = @id");
  await db.request().input("id", sql.Int, instanceId).query("DELETE FROM SqlServerDatabaseSnapshots WHERE InstanceId = @id");
  await db.request().input("id", sql.Int, instanceId).query("DELETE FROM SqlServerDeadlockEvents WHERE InstanceId = @id");
  await db.request().input("id", sql.Int, instanceId).query("DELETE FROM SqlServerBlockingEvents WHERE InstanceId = @id");
  await db.request().input("id", sql.Int, instanceId).query("DELETE FROM SqlServerSlowQueries WHERE InstanceId = @id");
  await db.request().input("id", sql.Int, instanceId).query("DELETE FROM SqlServerActiveSessions WHERE InstanceId = @id");
  await db.request().input("id", sql.Int, instanceId).query("DELETE FROM SqlServerInstances WHERE Id = @id");

  await logAdminAction({ admin, section: "sqlserver-monitoring", action: "remove_instance", details: existing.recordset[0].Name, req });

  return NextResponse.json({ ok: true });
}
