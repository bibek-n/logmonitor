import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { runPerformanceTest } from "@/lib/websitePerformance/runTest";
import { VALID_SCAN_DEVICES } from "@/lib/websitePerformance/shared";

export async function POST(req: NextRequest, { params }: { params: Promise<{ websiteId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const websiteId = Number((await params).websiteId);
  if (!Number.isInteger(websiteId)) return NextResponse.json({ ok: false, error: "Invalid websiteId." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const rawDevices = Array.isArray(body?.devices) ? body.devices : null;
  if (rawDevices && !rawDevices.every((d: unknown) => typeof d === "string" && VALID_SCAN_DEVICES.has(d))) {
    return NextResponse.json({ ok: false, error: "Invalid devices - must be Mobile and/or Desktop." }, { status: 400 });
  }

  try {
    const results = await runPerformanceTest({
      websiteId,
      devices: rawDevices ?? undefined,
      triggeredBy: "Manual",
      triggeredByUserId: admin.userId,
    });
    await logAdminAction({ admin, section: "website-performance", action: "run_test", details: `websiteId=${websiteId}`, req });
    return NextResponse.json({ ok: true, data: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to run performance test.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
