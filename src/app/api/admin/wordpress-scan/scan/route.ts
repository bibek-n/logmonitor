import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { runWordPressDeepScan } from "@/lib/wordpressScan/runScan";
import { saveWordPressScan } from "@/lib/wordpressScan/persist";

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
    report = await runWordPressDeepScan(url);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Scan failed." });
  }

  const scanId = await saveWordPressScan(report, websiteId, admin);
  await logAdminAction({ admin, section: "wordpress-scan", action: "scan", details: url, req });

  return NextResponse.json({ ok: true, scanId, report });
}
