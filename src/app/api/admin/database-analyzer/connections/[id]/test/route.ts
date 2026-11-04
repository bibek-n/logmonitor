import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireDbAnalyzerPermission, isDbAnalyzerSession } from "@/lib/requireDbAnalyzerPermission";
import { decryptSqlPassword } from "@/lib/sqlServerMonitoring/credentials";
import { testConnection } from "@/lib/dbAnalyzer/connectors";
import type { ConnectionConfig, DbEngine } from "@/lib/dbAnalyzer/types";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireDbAnalyzerPermission("dba_connections_manage");
  if (!isDbAnalyzerSession(admin)) return admin;

  const { id } = await params;
  const connectionId = Number(id);
  if (!Number.isInteger(connectionId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, connectionId)
    .query<{ Engine: DbEngine; Source: "live" | "upload"; HostName: string; Port: number; DatabaseName: string; Username: string; PasswordEncrypted: string }>(
      "SELECT Engine, Source, HostName, Port, DatabaseName, Username, PasswordEncrypted FROM DbAnalyzerConnections WHERE Id = @id"
    );
  const row = result.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "Connection not found" }, { status: 404 });
  if (row.Source === "upload") {
    return NextResponse.json({ ok: false, error: "This connection is an uploaded SQL file, not a live connection - use \"Scan now\" instead." }, { status: 400 });
  }

  const config: ConnectionConfig = {
    engine: row.Engine,
    host: row.HostName,
    port: row.Port,
    database: row.DatabaseName,
    username: row.Username,
    password: decryptSqlPassword(row.PasswordEncrypted),
  };

  try {
    await testConnection(config);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed." });
  }
}
