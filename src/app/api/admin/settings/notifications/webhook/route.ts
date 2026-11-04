import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

const ALLOWED_PLATFORMS = new Set(["slack", "teams", "generic"]);

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<{ Url: string | null; Platform: string; Enabled: boolean }>`
    SELECT Url, Platform, Enabled FROM WebhookSettings WHERE Id = 1
  `;
  return NextResponse.json({ ok: true, data: result.recordset[0] ?? null });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const platform = typeof body.platform === "string" && ALLOWED_PLATFORMS.has(body.platform) ? body.platform : "slack";
  const enabled = !!body.enabled;

  if (enabled && !url) {
    return NextResponse.json({ ok: false, error: "A webhook URL is required to enable this." }, { status: 400 });
  }
  if (url && !/^https:\/\//i.test(url)) {
    return NextResponse.json({ ok: false, error: "Webhook URL must start with https://" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("url", sql.NVarChar, url || null)
    .input("platform", sql.VarChar, platform)
    .input("enabled", sql.Bit, enabled)
    .input("updatedByUserId", sql.Int, admin.userId)
    .query(`
      UPDATE WebhookSettings SET Url = @url, Platform = @platform, Enabled = @enabled,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
      WHERE Id = 1
    `);

  await logAdminAction({ admin, section: "notifications", action: "update_webhook_settings", details: `platform=${platform} enabled=${enabled}`, req });

  return NextResponse.json({ ok: true });
}
