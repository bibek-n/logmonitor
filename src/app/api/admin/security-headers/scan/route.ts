import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { analyzeSecurityHeaders, CORE_HEADERS, UPCOMING_HEADERS } from "@/lib/securityHeaders";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const websiteId = body?.websiteId == null || body.websiteId === "" ? null : Number(body.websiteId);

  if (!url) return NextResponse.json({ ok: false, error: "A URL is required." });
  if (websiteId !== null && (!Number.isInteger(websiteId) || websiteId <= 0)) {
    return NextResponse.json({ ok: false, error: "Invalid websiteId." });
  }

  const db = await getDb();

  if (websiteId !== null) {
    const check = await db.request().input("id", sql.Int, websiteId).query<{ Id: number }>("SELECT Id FROM Websites WHERE Id = @id");
    if (!check.recordset[0]) return NextResponse.json({ ok: false, error: "Website not found." });
  }

  let report;
  try {
    report = await analyzeSecurityHeaders(url);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Scan failed." });
  }

  const insertResult = await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .input("targetUrl", sql.NVarChar, report.targetUrl)
    .input("finalUrl", sql.NVarChar, report.finalUrl)
    .input("ipAddress", sql.VarChar, report.ipAddress)
    .input("statusCode", sql.Int, report.statusCode)
    .input("grade", sql.VarChar, report.grade)
    .input("score", sql.Int, report.score)
    .input("headersJson", sql.NVarChar, JSON.stringify(report.headers))
    .input("missingHeadersJson", sql.NVarChar, JSON.stringify(report.missing))
    .input("presentHeadersJson", sql.NVarChar, JSON.stringify(report.present))
    .input("triggeredByUserId", sql.Int, admin.userId)
    .input("triggeredByUsername", sql.NVarChar, admin.username)
    .query<{ Id: number }>(`
      INSERT INTO SecurityHeaderScans
        (WebsiteId, TargetUrl, FinalUrl, IpAddress, StatusCode, Grade, Score, HeadersJson, MissingHeadersJson, PresentHeadersJson, TriggeredByUserId, TriggeredByUsername)
      OUTPUT INSERTED.Id
      VALUES
        (@websiteId, @targetUrl, @finalUrl, @ipAddress, @statusCode, @grade, @score, @headersJson, @missingHeadersJson, @presentHeadersJson, @triggeredByUserId, @triggeredByUsername)
    `);

  const scanId = insertResult.recordset[0].Id;

  await logAdminAction({ admin, section: "security-headers", action: "scan", details: url, req });

  return NextResponse.json({
    ok: true,
    scanId,
    report: { ...report, coreHeaders: CORE_HEADERS, upcomingHeaders: UPCOMING_HEADERS },
  });
}
