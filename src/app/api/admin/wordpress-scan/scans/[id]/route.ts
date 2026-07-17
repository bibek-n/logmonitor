import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import type { CheckSummary, DetectedPlugin, RiskLevel, ScanFinding } from "@/lib/wordpressScan/shared";

interface ScanDetailRow {
  Id: number;
  WebsiteId: number | null;
  TargetUrl: string;
  IsWordPress: boolean;
  CoreVersion: string | null;
  ThemeSlug: string | null;
  ThemeVersion: string | null;
  RiskLevel: string;
  FindingsJson: string;
  ChecksJson: string;
  PluginsJson: string;
  TriggeredByUsername: string | null;
  ScannedAt: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const scanId = Number(id);
  if (!Number.isInteger(scanId) || scanId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid scan id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, scanId).query<ScanDetailRow>(`
    SELECT Id, WebsiteId, TargetUrl, IsWordPress, CoreVersion, ThemeSlug, ThemeVersion, RiskLevel,
      FindingsJson, ChecksJson, PluginsJson, TriggeredByUsername,
      CONVERT(VARCHAR(19), ScannedAt, 126) AS ScannedAt
    FROM WordPressDeepScans
    WHERE Id = @id
  `);

  const row = result.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "Scan not found." }, { status: 404 });

  const findings: ScanFinding[] = JSON.parse(row.FindingsJson);
  const checks: CheckSummary[] = JSON.parse(row.ChecksJson);
  const plugins: DetectedPlugin[] = JSON.parse(row.PluginsJson);

  return NextResponse.json({
    ok: true,
    report: {
      id: row.Id,
      websiteId: row.WebsiteId,
      targetUrl: row.TargetUrl,
      isWordPress: row.IsWordPress,
      coreVersion: row.CoreVersion,
      themeSlug: row.ThemeSlug,
      themeVersion: row.ThemeVersion,
      riskLevel: row.RiskLevel as RiskLevel,
      findings,
      checks,
      plugins,
      triggeredByUsername: row.TriggeredByUsername,
      scannedAt: row.ScannedAt,
    },
  });
}
