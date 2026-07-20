import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

// Removing the row reverts the website to the default schedule (once daily, ~02:00).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ websiteId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { websiteId: websiteIdParam } = await params;
  const websiteId = Number(websiteIdParam);
  if (!Number.isInteger(websiteId) || websiteId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid website id" });
  }

  const db = await getDb();
  await db.request().input("websiteId", sql.Int, websiteId).query("DELETE FROM WebsiteScanSchedules WHERE WebsiteId = @websiteId");

  return NextResponse.json({ ok: true });
}
