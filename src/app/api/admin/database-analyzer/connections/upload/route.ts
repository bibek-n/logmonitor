import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireDbAnalyzerPermission, isDbAnalyzerSession } from "@/lib/requireDbAnalyzerPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { parseDdlToSchema } from "@/lib/dbAnalyzer/ddlParser";
import type { DbEngine } from "@/lib/dbAnalyzer/types";

const VALID_ENGINES: DbEngine[] = ["mssql", "mysql", "postgres"];
// Stays under IIS's default requestFiltering maxAllowedContentLength (~28.6 MB) with headroom
// to spare - raised from an initial 5 MB after a real schema dump exceeded it.
const MAX_SQL_FILE_BYTES = 20 * 1024 * 1024;

// A .sql DDL script is schema metadata, not row data, so - unlike a live connection's
// credentials - there's no privacy reason to discard it after parsing: it's kept verbatim so
// "Scan now" can re-parse it later without asking for a re-upload, same as a live connection
// can be re-scanned any number of times.
export async function POST(req: NextRequest) {
  const admin = await requireDbAnalyzerPermission("dba_connections_manage");
  if (!isDbAnalyzerSession(admin)) return admin;

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ ok: false, error: "Invalid form data." }, { status: 400 });

  const file = formData.get("file");
  const name = String(formData.get("name") ?? "").trim();
  const engine = String(formData.get("engine") ?? "");

  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "No file was uploaded." }, { status: 400 });
  if (!name) return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  if (!VALID_ENGINES.includes(engine as DbEngine)) {
    return NextResponse.json({ ok: false, error: "Engine must be mssql, mysql, or postgres." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".sql")) {
    return NextResponse.json({ ok: false, error: "Only .sql files are accepted." }, { status: 400 });
  }
  if (file.size > MAX_SQL_FILE_BYTES) {
    return NextResponse.json({ ok: false, error: "File is too large (20 MB limit)." }, { status: 400 });
  }

  const sqlText = await file.text();
  let tableCount = 0;
  try {
    tableCount = parseDdlToSchema(sqlText, engine as DbEngine).tables.length;
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Could not parse this SQL file: ${err instanceof Error ? err.message : "unknown error"}` }, { status: 400 });
  }
  if (tableCount === 0) {
    return NextResponse.json({ ok: false, error: "No CREATE TABLE statements were found in this file." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db
    .request()
    .input("name", sql.NVarChar, name)
    .input("engine", sql.VarChar, engine)
    .input("sqlText", sql.NVarChar, sqlText)
    .input("fileName", sql.NVarChar, file.name)
    .input("createdByUserId", sql.Int, admin.userId)
    .query<{ Id: number }>(`
      INSERT INTO DbAnalyzerConnections (Name, Engine, Source, UploadedSqlText, SourceFileName, CreatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@name, @engine, 'upload', @sqlText, @fileName, @createdByUserId)
    `);

  await logAdminAction({ admin, section: "database_analyzer", action: "create_connection_from_upload", details: `${name} (${file.name}, ${tableCount} tables)`, req });

  return NextResponse.json({ ok: true, id: result.recordset[0].Id, tableCount });
}
