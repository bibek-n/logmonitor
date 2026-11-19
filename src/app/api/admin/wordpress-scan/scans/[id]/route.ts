import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireWordpressScanPermission, isWordpressScanSession } from "@/lib/requireWordpressScanPermission";
import type { CheckSummary, DetectedPlugin, RiskLevel, ScanFinding } from "@/lib/wordpressScan/shared";

interface ScanDetailRow {
  Id: number;
  WebsiteId: number | null;
  TargetUrl: string;
  IsWordPress: boolean;
  BlockReason: string | null;
  CoreVersion: string | null;
  PhpVersion: string | null;
  LatestCoreVersion: string | null;
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
  const admin = await requireWordpressScanPermission("wps_view");
  if (!isWordpressScanSession(admin)) return admin;

  const { id } = await params;
  const scanId = Number(id);
  if (!Number.isInteger(scanId) || scanId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid scan id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, scanId).query<ScanDetailRow>(`
    SELECT Id, WebsiteId, TargetUrl, IsWordPress, BlockReason, CoreVersion, PhpVersion, LatestCoreVersion, ThemeSlug, ThemeVersion, RiskLevel,
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

  // This scan's findings are a per-scan JSON snapshot with no id of their own - the "Reason if
  // unresolved" note lives on WordPressFindings (the persistent, deduped-by-key tracker that
  // upsertFindingsForScan() updates every scan). Match each snapshot finding back to its
  // tracker row by (CheckId, Title) - the same identity computeFindingKey() uses - so this
  // report view can offer the same reason button the Findings tab does, for any finding tied
  // to a saved website.
  let findingsWithNotes: (ScanFinding & { findingId?: number; auditorNote?: string | null })[] = findings;
  if (row.WebsiteId !== null) {
    const trackerResult = await db
      .request()
      .input("websiteId", sql.Int, row.WebsiteId)
      .query<{ Id: number; CheckId: string; Title: string; AuditorNote: string | null }>(
        "SELECT Id, CheckId, Title, AuditorNote FROM WordPressFindings WHERE WebsiteId = @websiteId"
      );
    const byCheckAndTitle = new Map(trackerResult.recordset.map((t) => [`${t.CheckId}|${t.Title}`, t]));
    findingsWithNotes = findings.map((f) => {
      const tracked = byCheckAndTitle.get(`${f.check}|${f.title}`);
      return tracked ? { ...f, findingId: tracked.Id, auditorNote: tracked.AuditorNote } : f;
    });
  }

  return NextResponse.json({
    ok: true,
    report: {
      id: row.Id,
      websiteId: row.WebsiteId,
      targetUrl: row.TargetUrl,
      isWordPress: row.IsWordPress,
      blockReason: row.BlockReason,
      coreVersion: row.CoreVersion,
      phpVersion: row.PhpVersion,
      latestCoreVersion: row.LatestCoreVersion,
      themeSlug: row.ThemeSlug,
      themeVersion: row.ThemeVersion,
      riskLevel: row.RiskLevel as RiskLevel,
      findings: findingsWithNotes,
      checks,
      plugins,
      triggeredByUsername: row.TriggeredByUsername,
      scannedAt: row.ScannedAt,
    },
  });
}
