import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireDbAnalyzerPermission, isDbAnalyzerSession } from "@/lib/requireDbAnalyzerPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { encryptSqlPassword } from "@/lib/sqlServerMonitoring/credentials";
import type { DbEngine } from "@/lib/dbAnalyzer/types";

const VALID_ENGINES: DbEngine[] = ["mssql", "mysql", "postgres"];

export async function GET() {
  const admin = await requireDbAnalyzerPermission("dba_view");
  if (!isDbAnalyzerSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<{
    Id: number;
    Name: string;
    Engine: DbEngine;
    Source: "live" | "upload";
    HostName: string | null;
    Port: number | null;
    DatabaseName: string | null;
    Username: string | null;
    SourceFileName: string | null;
    Enabled: boolean;
    CreatedAt: string;
    LatestScanId: number | null;
    LatestScanDate: string | null;
    LatestStatus: string | null;
    LatestScore: number | null;
    LatestRisk: string | null;
  }>`
    SELECT c.Id, c.Name, c.Engine, c.Source, c.HostName, c.Port, c.DatabaseName, c.Username, c.SourceFileName, c.Enabled, c.CreatedAt,
           latest.Id AS LatestScanId, latest.CompletedAt AS LatestScanDate, latest.Status AS LatestStatus,
           latest.SecurityScore AS LatestScore, latest.RiskLevel AS LatestRisk
    FROM DbAnalyzerConnections c
    OUTER APPLY (
      SELECT TOP 1 s.Id, s.CompletedAt, s.Status, s.SecurityScore, s.RiskLevel
      FROM DbAnalyzerScans s
      WHERE s.ConnectionId = c.Id
      ORDER BY s.StartedAt DESC
    ) latest
    ORDER BY c.Name
  `;

  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const admin = await requireDbAnalyzerPermission("dba_connections_manage");
  if (!isDbAnalyzerSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const engine = body?.engine;
  const host = typeof body?.host === "string" ? body.host.trim() : "";
  const port = Number(body?.port);
  const database = typeof body?.database === "string" ? body.database.trim() : "";
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!name || !VALID_ENGINES.includes(engine) || !host || !Number.isInteger(port) || !database || !username || !password) {
    return NextResponse.json({ ok: false, error: "All fields are required and engine must be mssql, mysql, or postgres." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db
    .request()
    .input("name", sql.NVarChar, name)
    .input("engine", sql.VarChar, engine)
    .input("host", sql.NVarChar, host)
    .input("port", sql.Int, port)
    .input("database", sql.NVarChar, database)
    .input("username", sql.NVarChar, username)
    .input("password", sql.NVarChar, encryptSqlPassword(password))
    .input("createdByUserId", sql.Int, admin.userId)
    .query<{ Id: number }>(`
      INSERT INTO DbAnalyzerConnections (Name, Engine, HostName, Port, DatabaseName, Username, PasswordEncrypted, CreatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@name, @engine, @host, @port, @database, @username, @password, @createdByUserId)
    `);

  await logAdminAction({ admin, section: "database_analyzer", action: "create_connection", details: name, req });

  return NextResponse.json({ ok: true, id: result.recordset[0].Id });
}
