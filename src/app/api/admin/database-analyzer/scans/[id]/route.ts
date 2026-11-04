import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireDbAnalyzerPermission, isDbAnalyzerSession } from "@/lib/requireDbAnalyzerPermission";
import type { SchemaSnapshot } from "@/lib/dbAnalyzer/types";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireDbAnalyzerPermission("dba_view");
  if (!isDbAnalyzerSession(admin)) return admin;

  const { id } = await params;
  const scanId = Number(id);
  if (!Number.isInteger(scanId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  const scanResult = await db.request().input("id", sql.Int, scanId).query<{
    Id: number;
    ConnectionId: number;
    Status: string;
    StartedAt: string;
    CompletedAt: string | null;
    TableCount: number | null;
    FindingCount: number | null;
    SecurityScore: number | null;
    RiskLevel: string | null;
    ServerVersion: string | null;
    SchemaJson: string | null;
    ErrorMessage: string | null;
    ConnectionName: string;
    AnalysisMode: string | null;
    AiSummary: string | null;
    AiError: string | null;
  }>(`
    SELECT s.Id, s.ConnectionId, s.Status, s.StartedAt, s.CompletedAt, s.TableCount, s.FindingCount,
           s.SecurityScore, s.RiskLevel, s.ServerVersion, s.SchemaJson, s.ErrorMessage, c.Name AS ConnectionName,
           s.AnalysisMode, s.AiSummary, s.AiError
    FROM DbAnalyzerScans s
    JOIN DbAnalyzerConnections c ON c.Id = s.ConnectionId
    WHERE s.Id = @id
  `);
  const scan = scanResult.recordset[0];
  if (!scan) return NextResponse.json({ ok: false, error: "Scan not found" }, { status: 404 });

  const findingsResult = await db.request().input("id", sql.Int, scanId).query<{
    Id: number;
    Category: string;
    Severity: string;
    Title: string;
    Detail: string | null;
    Evidence: string | null;
    AffectedObject: string | null;
    Recommendation: string | null;
    Source: string | null;
  }>("SELECT Id, Category, Severity, Title, Detail, Evidence, AffectedObject, Recommendation, Source FROM DbAnalyzerFindings WHERE ScanId = @id ORDER BY CASE Severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END");

  const schema: SchemaSnapshot | null = scan.SchemaJson ? JSON.parse(scan.SchemaJson) : null;

  return NextResponse.json({
    ok: true,
    scan: { ...scan, SchemaJson: undefined },
    schema,
    findings: findingsResult.recordset,
  });
}
