import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireDbAnalyzerPermission, isDbAnalyzerSession } from "@/lib/requireDbAnalyzerPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { encryptSqlPassword } from "@/lib/sqlServerMonitoring/credentials";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireDbAnalyzerPermission("dba_view");
  if (!isDbAnalyzerSession(admin)) return admin;

  const { id } = await params;
  const connectionId = Number(id);
  if (!Number.isInteger(connectionId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  const connResult = await db
    .request()
    .input("id", sql.Int, connectionId)
    .query<{
      Id: number;
      Name: string;
      Engine: string;
      Source: "live" | "upload";
      HostName: string | null;
      Port: number | null;
      DatabaseName: string | null;
      Username: string | null;
      SourceFileName: string | null;
      Enabled: boolean;
      CreatedAt: string;
    }>(
      "SELECT Id, Name, Engine, Source, HostName, Port, DatabaseName, Username, SourceFileName, Enabled, CreatedAt FROM DbAnalyzerConnections WHERE Id = @id"
    );
  const connection = connResult.recordset[0];
  if (!connection) return NextResponse.json({ ok: false, error: "Connection not found" }, { status: 404 });

  const historyResult = await db
    .request()
    .input("id", sql.Int, connectionId)
    .query<{
      Id: number;
      Status: string;
      StartedAt: string;
      CompletedAt: string | null;
      TableCount: number | null;
      FindingCount: number | null;
      SecurityScore: number | null;
      RiskLevel: string | null;
      ErrorMessage: string | null;
      AnalysisMode: string | null;
    }>(
      "SELECT Id, Status, StartedAt, CompletedAt, TableCount, FindingCount, SecurityScore, RiskLevel, ErrorMessage, AnalysisMode FROM DbAnalyzerScans WHERE ConnectionId = @id ORDER BY StartedAt DESC"
    );

  return NextResponse.json({ ok: true, connection, history: historyResult.recordset });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireDbAnalyzerPermission("dba_connections_manage");
  if (!isDbAnalyzerSession(admin)) return admin;

  const { id } = await params;
  const connectionId = Number(id);
  const body = await req.json().catch(() => null);
  if (!Number.isInteger(connectionId) || !body) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });

  const db = await getDb();
  const sourceResult = await db.request().input("id", sql.Int, connectionId).query<{ Source: "live" | "upload" }>(
    "SELECT Source FROM DbAnalyzerConnections WHERE Id = @id"
  );
  const source = sourceResult.recordset[0]?.Source;
  if (!source) return NextResponse.json({ ok: false, error: "Connection not found" }, { status: 404 });

  if (source === "upload") {
    // Nothing to update except name/enabled - there's no host/port/credentials, and re-
    // uploading a new file is a separate action (delete + re-upload), not an edit.
    await db
      .request()
      .input("id", sql.Int, connectionId)
      .input("name", sql.NVarChar, String(body.name ?? "").trim())
      .input("enabled", sql.Bit, body.enabled !== false)
      .query(`UPDATE DbAnalyzerConnections SET Name=@name, Enabled=@enabled WHERE Id=@id`);

    await logAdminAction({ admin, section: "database_analyzer", action: "update_connection", details: `connectionId=${connectionId}`, req });
    return NextResponse.json({ ok: true });
  }

  const request = db
    .request()
    .input("id", sql.Int, connectionId)
    .input("name", sql.NVarChar, String(body.name ?? "").trim())
    .input("host", sql.NVarChar, String(body.host ?? "").trim())
    .input("port", sql.Int, Number(body.port))
    .input("database", sql.NVarChar, String(body.database ?? "").trim())
    .input("username", sql.NVarChar, String(body.username ?? "").trim())
    .input("enabled", sql.Bit, body.enabled !== false);

  if (typeof body.password === "string" && body.password.length > 0) {
    request.input("password", sql.NVarChar, encryptSqlPassword(body.password));
    await request.query(`
      UPDATE DbAnalyzerConnections SET Name=@name, HostName=@host, Port=@port, DatabaseName=@database,
        Username=@username, Enabled=@enabled, PasswordEncrypted=@password
      WHERE Id=@id
    `);
  } else {
    await request.query(`
      UPDATE DbAnalyzerConnections SET Name=@name, HostName=@host, Port=@port, DatabaseName=@database,
        Username=@username, Enabled=@enabled
      WHERE Id=@id
    `);
  }

  await logAdminAction({ admin, section: "database_analyzer", action: "update_connection", details: `connectionId=${connectionId}`, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireDbAnalyzerPermission("dba_connections_manage");
  if (!isDbAnalyzerSession(admin)) return admin;

  const { id } = await params;
  const connectionId = Number(id);
  if (!Number.isInteger(connectionId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  await db.request().input("id", sql.Int, connectionId).query("DELETE FROM DbAnalyzerConnections WHERE Id = @id");

  await logAdminAction({ admin, section: "database_analyzer", action: "delete_connection", details: `connectionId=${connectionId}`, req });

  return NextResponse.json({ ok: true });
}
