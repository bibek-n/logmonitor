import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { decryptScreenshot, readScreenshotFile } from "@/lib/screenshotStorage";

function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const screenshotId = Number(id);
  if (!Number.isInteger(screenshotId)) {
    return NextResponse.json({ ok: false, error: "Invalid screenshot id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, screenshotId)
    .query<{ FilePath: string; DeletedAt: string | null; CapturedAt: string; Format: string }>(
      "SELECT FilePath, DeletedAt, CapturedAt, Format FROM Screenshots WHERE Id = @id"
    );
  const screenshot = result.recordset[0];
  if (!screenshot || screenshot.DeletedAt) {
    return NextResponse.json({ ok: false, error: "Screenshot not found" }, { status: 404 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  const action = download ? "downloaded" : "viewed";

  await db
    .request()
    .input("screenshotId", sql.Int, screenshotId)
    .input("userId", sql.Int, admin.userId)
    .input("action", sql.VarChar, action)
    .input("ip", sql.VarChar, clientIp(req))
    .query("INSERT INTO ScreenshotAuditLog (ScreenshotId, UserId, Action, IpAddress) VALUES (@screenshotId, @userId, @action, @ip)");

  const encrypted = await readScreenshotFile(screenshot.FilePath);
  const plain = decryptScreenshot(encrypted);

  const ext = screenshot.Format === "jpeg" ? "jpg" : "png";
  const headers: Record<string, string> = { "Content-Type": screenshot.Format === "jpeg" ? "image/jpeg" : "image/png" };
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="screenshot-${screenshotId}-${screenshot.CapturedAt}.${ext}"`;
  }

  return new NextResponse(new Uint8Array(plain), { headers });
}
