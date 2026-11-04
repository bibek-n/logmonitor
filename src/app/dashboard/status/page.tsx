import { getMonitoringSummary, getRecentIncidents, getOfflineDevices, getExpiringSslCertificates } from "@/lib/dashboardLayouts/queries";
import { StatusClient } from "@/components/status/StatusClient";

export const dynamic = "force-dynamic";

// Internal-only status overview (kept behind the same dashboard auth as everything else - the
// user explicitly chose not to expose this publicly). Reuses the same data sources the
// Overview dashboard's own widgets already query, just assembled into one clean "is everything
// up" view that's easy to point a colleague at instead of them hunting across several widgets.
export default async function StatusPage() {
  const [monitoring, incidents, offlineDevices, expiringSsl] = await Promise.all([
    getMonitoringSummary().catch(() => ({ websitesUp: 0, websitesDown: 0, apisUp: 0, apisDown: 0, avgResponseMs: null, errorRatePct: null })),
    getRecentIncidents(10).catch(() => []),
    getOfflineDevices({ withinDays: 1 }).catch(() => []),
    getExpiringSslCertificates({ withinDays: 14 }).catch(() => []),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>System Status</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        A single internal view of whether everything is up - kept inside the dashboard rather than published publicly.
      </p>
      <StatusClient monitoring={monitoring} incidents={incidents} offlineDeviceCount={offlineDevices.length} expiringSslCount={expiringSsl.length} />
    </div>
  );
}
