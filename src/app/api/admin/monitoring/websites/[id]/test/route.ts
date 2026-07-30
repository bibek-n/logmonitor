import { NextRequest, NextResponse } from "next/server";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { testWebsiteMonitorSchema } from "@/lib/websiteApiMonitoring/schema";
import { checkWebsite } from "@/lib/websiteApiMonitoring/websiteChecker";
import { checkMultiRegion } from "@/lib/websiteApiMonitoring/multiRegionChecker";
import { loadWebsiteMonitorById } from "@/lib/websiteApiMonitoring/repository";

// Runs one immediate real check using either the saved monitor's configuration (default) or
// an overridden payload (for "Save and Test" on the create/edit form, before the monitor even
// exists yet as row Id `new`). Never writes to MonitorResults and never triggers incidents or
// alerts - spec section 11's explicit "testing a monitor must not create an incident."
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_test");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = testWebsiteMonitorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid test payload" }, { status: 400 });
  }
  const p = parsed.data;

  if (id !== "new") {
    const existing = await loadWebsiteMonitorById(Number(id));
    if (!existing) return NextResponse.json({ ok: false, error: "Monitor not found" }, { status: 404 });
  }

  const result = await checkWebsite(
    {
      monitorId: id === "new" ? 0 : Number(id),
      url: p.url,
      httpMethod: p.httpMethod,
      expectedStatusCode: p.expectedStatusCode,
      followRedirects: p.followRedirects,
      maxRedirects: p.maxRedirects,
      sslVerify: p.sslVerify,
      expectedKeyword: p.expectedKeyword ?? null,
      forbiddenKeyword: p.forbiddenKeyword ?? null,
      responseTimeWarningMs: 1000,
      responseTimeCriticalMs: 3000,
      alertEmail: null,
    },
    { timeoutMs: p.timeoutMs, maxRedirects: p.maxRedirects, maxResponseBytes: 25 * 1024 * 1024 }
  );

  // Preview the same multi-region majority vote the scheduled scan will actually use to decide
  // Up/Down, so "Test Monitor" doesn't show a misleadingly rosier (or gloomier) picture than
  // what real monitoring will report - see multiRegionChecker.ts for why this exists.
  const multiRegion = await checkMultiRegion(p.url, p.expectedStatusCode, p.followRedirects);

  return NextResponse.json({ ok: true, data: { ...result, multiRegion } });
}
