import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { getBandwidthQuotaSettings, updateBandwidthQuotaSettings, getBandwidthQuotaBreaches } from "@/lib/bandwidthQuota";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const settings = await getBandwidthQuotaSettings();
  const hours = Number(req.nextUrl.searchParams.get("hours")) || 24;
  const breaches = await getBandwidthQuotaBreaches(hours);
  return NextResponse.json({ ok: true, settings, breaches });
}

const bodySchema = z.object({
  dailyCapGb: z.number().min(0.1).max(10000).nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
  }

  await updateBandwidthQuotaSettings(parsed.data, admin.userId);
  await logAdminAction({ admin, section: "network", action: "bandwidth_quota_update", details: JSON.stringify(parsed.data), req });

  return NextResponse.json({ ok: true });
}
