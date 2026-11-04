import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireWordpressScanPermission, isWordpressScanSession } from "@/lib/requireWordpressScanPermission";
import type { CheckSummary, DetectedPlugin, ScanFinding } from "@/lib/wordpressScan/shared";
import { generateWordPressScanPdf, wordpressScanPdfFilename } from "@/lib/wordpressScan/generatePdf";

interface ScanPdfRow {
  TargetUrl: string;
  IsWordPress: boolean;
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
  WebsiteName: string | null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWordpressScanPermission("wps_view");
  if (!isWordpressScanSession(admin)) return admin;

  const inline = req.nextUrl.searchParams.get("view") === "1";

  const { id } = await params;
  const scanId = Number(id);
  if (!Number.isInteger(scanId) || scanId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid scan id." }, { status: 400 });
  }

  const db = await getDb();
  // LEFT JOIN, not INNER - an ad-hoc scan against a URL that was never saved to the Websites
  // list (WebsiteId IS NULL) still has a full report to print, it just has no friendly name.
  const result = await db.request().input("id", sql.Int, scanId).query<ScanPdfRow>(`
    SELECT s.TargetUrl, s.IsWordPress, s.CoreVersion, s.PhpVersion, s.LatestCoreVersion, s.ThemeSlug, s.ThemeVersion,
      s.RiskLevel, s.FindingsJson, s.ChecksJson, s.PluginsJson, s.TriggeredByUsername,
      CONVERT(VARCHAR(19), s.ScannedAt, 126) AS ScannedAt,
      w.Name AS WebsiteName
    FROM WordPressDeepScans s
    LEFT JOIN Websites w ON w.Id = s.WebsiteId
    WHERE s.Id = @id
  `);

  const row = result.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "Scan not found." }, { status: 404 });

  const findings: ScanFinding[] = JSON.parse(row.FindingsJson);
  const checks: CheckSummary[] = JSON.parse(row.ChecksJson);
  const plugins: DetectedPlugin[] = JSON.parse(row.PluginsJson);
  const websiteName = row.WebsiteName ?? new URL(row.TargetUrl).hostname;

  const pdfBytes = await generateWordPressScanPdf({
    websiteName,
    targetUrl: row.TargetUrl,
    isWordPress: row.IsWordPress,
    coreVersion: row.CoreVersion,
    phpVersion: row.PhpVersion,
    latestCoreVersion: row.LatestCoreVersion,
    themeSlug: row.ThemeSlug,
    themeVersion: row.ThemeVersion,
    plugins,
    findings,
    checks,
    riskLevel: row.RiskLevel,
    scannedAt: row.ScannedAt,
    triggeredByUsername: row.TriggeredByUsername,
  });
  const filename = wordpressScanPdfFilename(websiteName, row.ScannedAt);

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
    },
  });
}
