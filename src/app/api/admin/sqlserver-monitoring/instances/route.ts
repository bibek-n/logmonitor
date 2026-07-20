import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { encryptSqlPassword } from "@/lib/sqlServerMonitoring/credentials";

const VALID_AUTH_TYPES = new Set(["sql", "windows"]);
const VALID_ENGINES = new Set(["mssql", "mysql", "postgres"]);
const DEFAULT_PORT_BY_ENGINE: Record<string, number> = { mssql: 1433, mysql: 3306, postgres: 5432 };

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query`
    SELECT Id, Name, HostName, Port, AuthType, SqlUsername, IsSelfMonitoring, Engine, Enabled,
      CONVERT(VARCHAR(19), LastCheckAt, 126) AS LastCheckAt, LastCheckStatus, LastErrorMessage,
      CASE WHEN SshHost IS NOT NULL THEN 1 ELSE 0 END AS HasSshBackupCheck
    FROM SqlServerInstances ORDER BY IsSelfMonitoring DESC, Name ASC
  `;
  return NextResponse.json({ ok: true, data: result.recordset });
}

// Registers a NEW remote SQL Server instance to monitor - the self-monitoring row (this
// app's own database) is seeded once by the migration and isn't created through this route.
// The SQL password is encrypted at rest immediately (never stored/logged in plaintext) and
// never returned by GET above.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  const hostName = typeof body?.hostName === "string" ? body.hostName.trim() : "";
  const engine = typeof body?.engine === "string" && VALID_ENGINES.has(body.engine) ? body.engine : "mssql";
  const port = typeof body?.port === "number" && Number.isInteger(body.port) ? body.port : DEFAULT_PORT_BY_ENGINE[engine];
  // MySQL/PostgreSQL only support username+password auth through this app - "windows" auth is
  // an MSSQL-only concept, so authType is forced to 'sql' for those two engines.
  const authType = engine === "mssql" && typeof body?.authType === "string" ? body.authType : "sql";
  const sqlUsername = typeof body?.sqlUsername === "string" ? body.sqlUsername.trim() : "";
  const sqlPassword = typeof body?.sqlPassword === "string" ? body.sqlPassword : "";

  // Optional SSH-based backup-status check (see backupStatusSsh.ts) - only meaningful for
  // engines with no built-in backup catalog (MySQL today). All-or-nothing: a partial set
  // (e.g. host with no username) is treated as "not configured" rather than stored broken.
  const sshHost = typeof body?.sshHost === "string" ? body.sshHost.trim() : "";
  const sshUsername = typeof body?.sshUsername === "string" ? body.sshUsername.trim() : "";
  const sshPassword = typeof body?.sshPassword === "string" ? body.sshPassword : "";
  const sshPort = typeof body?.sshPort === "number" && Number.isInteger(body.sshPort) ? body.sshPort : 22;
  const backupBaseDir = typeof body?.backupBaseDir === "string" && body.backupBaseDir.trim() ? body.backupBaseDir.trim() : null;
  const hasSshConfig = !!(sshHost && sshUsername && sshPassword);

  if (!name) return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  if (!hostName) return NextResponse.json({ ok: false, error: "Host name is required." }, { status: 400 });
  if (!VALID_AUTH_TYPES.has(authType)) return NextResponse.json({ ok: false, error: "Auth type must be 'sql' or 'windows'." }, { status: 400 });
  if (authType === "sql" && (!sqlUsername || !sqlPassword)) {
    return NextResponse.json({ ok: false, error: "SQL authentication requires a username and password." }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("name", sql.NVarChar, name)
    .input("hostName", sql.NVarChar, hostName)
    .input("port", sql.Int, port)
    .input("authType", sql.VarChar, authType)
    .input("engine", sql.VarChar, engine)
    .input("sqlUsername", sql.NVarChar, authType === "sql" ? sqlUsername : null)
    .input("sqlPasswordEncrypted", sql.NVarChar, authType === "sql" ? encryptSqlPassword(sqlPassword) : null)
    .input("sshHost", sql.NVarChar, hasSshConfig ? sshHost : null)
    .input("sshPort", sql.Int, hasSshConfig ? sshPort : null)
    .input("sshUsername", sql.NVarChar, hasSshConfig ? sshUsername : null)
    .input("sshPasswordEncrypted", sql.NVarChar, hasSshConfig ? encryptSqlPassword(sshPassword) : null)
    .input("backupBaseDir", sql.NVarChar, hasSshConfig ? backupBaseDir : null)
    .query(`
      INSERT INTO SqlServerInstances (Name, HostName, Port, AuthType, Engine, SqlUsername, SqlPasswordEncrypted, IsSelfMonitoring, Enabled, SshHost, SshPort, SshUsername, SshPasswordEncrypted, BackupBaseDir)
      VALUES (@name, @hostName, @port, @authType, @engine, @sqlUsername, @sqlPasswordEncrypted, 0, 1, @sshHost, @sshPort, @sshUsername, @sshPasswordEncrypted, @backupBaseDir)
    `);

  await logAdminAction({ admin, section: "sqlserver-monitoring", action: "add_instance", details: `${name} (${engine}, ${hostName}:${port})`, req });

  return NextResponse.json({ ok: true });
}
