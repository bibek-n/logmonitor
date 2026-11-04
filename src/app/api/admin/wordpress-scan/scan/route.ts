import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireWordpressScanPermission, isWordpressScanSession } from "@/lib/requireWordpressScanPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { runWordPressDeepScan } from "@/lib/wordpressScan/runScan";
import { saveWordPressScan } from "@/lib/wordpressScan/persist";
import { isScanProfile } from "@/lib/wordpressScan/shared";

export async function POST(req: NextRequest) {
  const admin = await requireWordpressScanPermission("wps_scan");
  if (!isWordpressScanSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const websiteId = body?.websiteId == null || body.websiteId === "" ? null : Number(body.websiteId);
  // Defaults to "comprehensive" (unchanged old behavior) for any caller that omits it.
  const profile = isScanProfile(body?.profile) ? body.profile : "comprehensive";

  if (!url) return NextResponse.json({ ok: false, error: "A URL is required." });
  if (websiteId !== null && (!Number.isInteger(websiteId) || websiteId <= 0)) {
    return NextResponse.json({ ok: false, error: "Invalid websiteId." });
  }

  const db = await getDb();
  let knownPhpVersion: string | null = null;
  if (websiteId !== null) {
    const check = await db
      .request()
      .input("id", sql.Int, websiteId)
      .query<{ Id: number; PhpVersion: string | null }>("SELECT Id, PhpVersion FROM Websites WHERE Id = @id");
    const row = check.recordset[0];
    if (!row) return NextResponse.json({ ok: false, error: "Website not found." });
    knownPhpVersion = row.PhpVersion;
  }

  let report;
  try {
    report = await runWordPressDeepScan(url, undefined, knownPhpVersion, profile);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Scan failed." });
  }

  const scanId = await saveWordPressScan(report, websiteId, admin);
  await logAdminAction({ admin, section: "wordpress-scan", action: "scan", details: url, req });

  return NextResponse.json({ ok: true, scanId, report });
}
