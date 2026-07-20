import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { createScanRow, runUrlScan } from "@/lib/threatScanner/runScan";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const websiteId = body?.websiteId == null || body.websiteId === "" ? null : Number(body.websiteId);

  if (!url) return NextResponse.json({ ok: false, error: "A URL is required." });
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ ok: false, error: "That doesn't look like a valid URL (include the http:// or https:// prefix)." });
  }
  if (websiteId !== null && (!Number.isInteger(websiteId) || websiteId <= 0)) {
    return NextResponse.json({ ok: false, error: "Invalid websiteId." });
  }

  if (websiteId !== null) {
    const db = await getDb();
    const check = await db.request().input("id", sql.Int, websiteId).query<{ Id: number }>("SELECT Id FROM Websites WHERE Id = @id");
    if (!check.recordset[0]) return NextResponse.json({ ok: false, error: "Website not found." });
  }

  let scanId: number;
  try {
    scanId = await createScanRow({
      kind: "Url",
      target: url,
      websiteId,
      triggeredByUserId: admin.userId,
      triggeredByUsername: admin.username,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to start scan." });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  void runUrlScan(scanId, url)
    .then(() => logAdminAction({ admin, section: "threat-scanner", action: "scan_url", details: url, ipAddress: clientIp }))
    .catch((err) => {
      console.error(`[threat-scanner] url scan ${scanId} did not complete:`, err instanceof Error ? err.message : err);
    });

  return NextResponse.json({ ok: true, scanId });
}
