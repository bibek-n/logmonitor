import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { getIntegrationProvider } from "@/lib/integrationsConfig";

// Config storage only — see the approved plan and src/lib/integrationsConfig.ts: no live
// OAuth/API calls are made to any of these providers in this phase.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { key } = await params;
  const provider = getIntegrationProvider(key);
  if (!provider) return NextResponse.json({ ok: false, error: "Unknown integration." }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  const config: Record<string, string> = {};
  for (const field of provider.fields) {
    if (typeof body.config?.[field.key] === "string") config[field.key] = body.config[field.key];
  }

  const db = await getDb();
  await db
    .request()
    .input("providerKey", sql.NVarChar, key)
    .input("enabled", sql.Bit, !!body.enabled)
    .input("configJson", sql.NVarChar, JSON.stringify(config))
    .input("updatedByUserId", sql.Int, admin.userId)
    .query(`
      UPDATE Integrations SET Enabled = @enabled, ConfigJson = @configJson, UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
      WHERE ProviderKey = @providerKey
    `);

  await logAdminAction({ admin, section: "integrations", action: "update_integration", details: key, req });

  return NextResponse.json({ ok: true });
}
