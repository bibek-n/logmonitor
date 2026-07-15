import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { runPerformanceTest } from "@/lib/websitePerformance/runTest";
import { VALID_SCAN_DEVICES } from "@/lib/websitePerformance/shared";

const MAX_BULK = 25;

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const websiteIds: number[] = Array.isArray(body?.websiteIds)
    ? body.websiteIds.map((v: unknown) => Number(v)).filter((v: number) => Number.isInteger(v))
    : [];
  const rawDevices = Array.isArray(body?.devices) ? body.devices : null;
  if (rawDevices && !rawDevices.every((d: unknown) => typeof d === "string" && VALID_SCAN_DEVICES.has(d))) {
    return NextResponse.json({ ok: false, error: "Invalid devices - must be Mobile and/or Desktop." }, { status: 400 });
  }
  if (websiteIds.length === 0) return NextResponse.json({ ok: false, error: "At least one websiteId is required." }, { status: 400 });
  if (websiteIds.length > MAX_BULK) return NextResponse.json({ ok: false, error: `A bulk run is limited to ${MAX_BULK} websites at once.` }, { status: 400 });

  const results: { websiteId: number; ok: boolean; error?: string }[] = [];
  for (const websiteId of websiteIds) {
    try {
      await runPerformanceTest({ websiteId, devices: rawDevices ?? undefined, triggeredBy: "Manual", triggeredByUserId: admin.userId });
      results.push({ websiteId, ok: true });
    } catch (err) {
      results.push({ websiteId, ok: false, error: err instanceof Error ? err.message : "Failed to run test." });
    }
  }

  await logAdminAction({ admin, section: "website-performance", action: "bulk_run_test", details: `count=${websiteIds.length}`, req });
  return NextResponse.json({ ok: true, data: results });
}
