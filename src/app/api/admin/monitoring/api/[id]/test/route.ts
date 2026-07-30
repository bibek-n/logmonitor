import { NextRequest, NextResponse } from "next/server";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { testApiMonitorSchema } from "@/lib/websiteApiMonitoring/schema";
import { checkApi } from "@/lib/websiteApiMonitoring/apiChecker";
import { loadApiMonitorById } from "@/lib/websiteApiMonitoring/repository";
import { mergeApiAuthConfigSecrets } from "@/lib/websiteApiMonitoring/apiCredentials";

// Runs one immediate real check, exactly like the website monitor's /test route: never writes
// to MonitorResults and never triggers incidents or alerts. For an existing monitor being
// edited, a secret field left untouched (still the mask placeholder from the GET response) is
// resolved back to the real saved secret before the request goes out - otherwise "Test Monitor"
// on an edit form that never touched auth would send the literal placeholder string instead of
// a working credential.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_test");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = testApiMonitorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid test payload" }, { status: 400 });
  }
  const p = parsed.data;

  let authConfig = p.authConfig;
  if (id !== "new") {
    const existing = await loadApiMonitorById(Number(id));
    if (!existing) return NextResponse.json({ ok: false, error: "Monitor not found" }, { status: 404 });
    authConfig = mergeApiAuthConfigSecrets(p.authConfig, existing.config.authConfig);
  }

  const result = await checkApi(
    {
      monitorId: id === "new" ? 0 : Number(id),
      url: p.url,
      httpMethod: p.httpMethod,
      headers: p.headers,
      queryParams: p.queryParams,
      requestBody: p.requestBody ?? null,
      requestBodyContentType: p.requestBodyContentType ?? null,
      authType: p.authType,
      authConfig,
      expectedStatusCode: p.expectedStatusCode,
      followRedirects: p.followRedirects,
      maxRedirects: p.maxRedirects,
      sslVerify: p.sslVerify,
      assertions: p.assertions,
      responseTimeWarningMs: 1000,
      responseTimeCriticalMs: 3000,
      alertEmail: null,
    },
    { timeoutMs: p.timeoutMs, maxRedirects: p.maxRedirects, maxResponseBytes: 25 * 1024 * 1024 }
  );

  return NextResponse.json({ ok: true, data: result });
}
