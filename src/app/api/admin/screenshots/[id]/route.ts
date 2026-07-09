import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { deleteScreenshotFile } from "@/lib/screenshotStorage";

function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}

// Soft-deletes: the Screenshots row and its ScreenshotAuditLog history both survive (the
// audit trail must outlive the screenshot itself), only the on-disk file and the ability to
// view/download are actually removed.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    .query<{ FilePath: string; DeletedAt: string | null }>("SELECT FilePath, DeletedAt FROM Screenshots WHERE Id = @id");
  const screenshot = result.recordset[0];
  if (!screenshot || screenshot.DeletedAt) {
    return NextResponse.json({ ok: false, error: "Screenshot not found" }, { status: 404 });
  }

  await db
    .request()
    .input("screenshotId", sql.Int, screenshotId)
    .input("userId", sql.Int, admin.userId)
    .input("ip", sql.VarChar, clientIp(req))
    .query("INSERT INTO ScreenshotAuditLog (ScreenshotId, UserId, Action, IpAddress) VALUES (@screenshotId, @userId, 'deleted', @ip)");

  await db.request().input("id", sql.Int, screenshotId).query("UPDATE Screenshots SET DeletedAt = SYSUTCDATETIME() WHERE Id = @id");

  await deleteScreenshotFile(screenshot.FilePath);

  return NextResponse.json({ ok: true });
}
