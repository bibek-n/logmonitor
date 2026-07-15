import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

// Screenshots are stored outside the web root (agent-storage/website-performance-screenshots,
// same directory-outside-webroot pattern as websiteSecurityAudit/generatePdf.ts's PDF
// reports) and served only through this authenticated route, never a static/public URL.
export async function GET(req: NextRequest, { params }: { params: Promise<{ websiteId: string; scanId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { websiteId: websiteIdStr, scanId: scanIdStr } = await params;
  const websiteId = Number(websiteIdStr);
  const scanId = Number(scanIdStr);
  if (!Number.isInteger(websiteId) || !Number.isInteger(scanId)) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, scanId)
    .input("websiteId", sql.Int, websiteId)
    .query<{ ScreenshotPath: string | null }>("SELECT ScreenshotPath FROM WebsitePerformanceScans WHERE Id = @id AND WebsiteId = @websiteId");
  const screenshotPath = result.recordset[0]?.ScreenshotPath;
  if (!screenshotPath) return NextResponse.json({ ok: false, error: "No screenshot for this scan." }, { status: 404 });

  const dir = path.join(process.cwd(), "agent-storage", "website-performance-screenshots");
  const filePath = path.join(dir, screenshotPath);
  if (!filePath.startsWith(dir)) return NextResponse.json({ ok: false, error: "Invalid path." }, { status: 400 });

  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).replace(".", "") || "jpeg";
    return new NextResponse(buffer, { headers: { "Content-Type": `image/${ext}` } });
  } catch {
    return NextResponse.json({ ok: false, error: "Screenshot file not found." }, { status: 404 });
  }
}
