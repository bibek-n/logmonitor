import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { createApiMonitorSchema } from "@/lib/websiteApiMonitoring/schema";
import { listApiMonitors, insertApiMonitor, ApiMonitorRow } from "@/lib/websiteApiMonitoring/repository";
import { maskApiAuthConfig } from "@/lib/websiteApiMonitoring/apiCredentials";

// Never send a decrypted auth secret to the browser - list/detail responses substitute the
// mask placeholder for whichever secret field the configured auth type has (see
// apiCredentials.ts's maskApiAuthConfig).
function maskMonitor(m: ApiMonitorRow): ApiMonitorRow {
  return { ...m, config: { ...m.config, authConfig: maskApiAuthConfig(m.config.authConfig) } };
}

export async function GET() {
  const mon = await requireMonitoringPermission("mon_view");
  if (!isMonitoringSession(mon)) return mon;

  const monitors = await listApiMonitors();
  return NextResponse.json({ ok: true, data: monitors.map(maskMonitor) });
}

export async function POST(req: NextRequest) {
  const mon = await requireMonitoringPermission("mon_api_create");
  if (!isMonitoringSession(mon)) return mon;

  const body = await req.json().catch(() => null);
  const parsed = createApiMonitorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid monitor payload" }, { status: 400 });
  }
  const p = parsed.data;
  const monitorId = await insertApiMonitor(p, mon.userId);

  await logAdminAction({ admin: mon, section: "monitoring", action: "api_monitor_create", details: `${p.name} (${p.url})`, req });

  return NextResponse.json({ ok: true, data: { id: monitorId } });
}
