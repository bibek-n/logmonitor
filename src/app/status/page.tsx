import { getPublicStatus, type PublicMonitorStatus } from "@/lib/websiteApiMonitoring/publicStatus";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Narrow SELECT, same as /api/public/branding - this page predates CompanySettings having a
// CompanyName/LogoPath worth showing, so it shipped with zero company identity on a page that's
// otherwise the single most customer-facing surface in the whole app. Best-effort: any read
// failure just falls back to the generic "Service Status" title, never breaks the page.
async function getStatusPageBranding(): Promise<{ companyName: string | null; logoPath: string | null }> {
  try {
    const db = await getDb();
    const result = await db.query<{ CompanyName: string | null; LogoPath: string | null }>`
      SELECT CompanyName, LogoPath FROM CompanySettings WHERE Id = 1
    `;
    const row = result.recordset[0];
    return { companyName: row?.CompanyName ?? null, logoPath: row?.LogoPath ?? null };
  } catch {
    return { companyName: null, logoPath: null };
  }
}

// Public, unauthenticated status page (see src/middleware.ts - only /dashboard/* and a short
// list of API prefixes require auth, so a route outside both, same as /notification-popup and
// /remote-support-consent, is reachable with no login). Deliberately narrower than the internal
// /dashboard/status page: Website monitors only, no API monitors, no device fleet data, no
// admin-authored incident text - see publicStatus.ts for the full reasoning.
const STATUS_COLOR: Record<PublicMonitorStatus, string> = {
  Operational: "#16a34a",
  Degraded: "#d97706",
  Down: "#dc2626",
  Maintenance: "#6b7280",
  Unknown: "#9ca3af",
};

const STATUS_LABEL: Record<PublicMonitorStatus, string> = {
  Operational: "Operational",
  Degraded: "Degraded Performance",
  Down: "Down",
  Maintenance: "Under Maintenance",
  Unknown: "Checking...",
};

function formatDuration(startedAt: string, resolvedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export default async function PublicStatusPage() {
  const [data, branding] = await Promise.all([getPublicStatus(), getStatusPageBranding()]);

  const downCount = data.monitors.filter((m) => m.status === "Down").length;
  const degradedCount = data.monitors.filter((m) => m.status === "Degraded").length;
  const allOperational = downCount === 0 && degradedCount === 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", color: "#1a1a1a", padding: "2.5rem 1rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
          {branding.logoPath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoPath} alt={branding.companyName ?? "Company logo"} style={{ height: 28, width: "auto" }} />
          )}
          <h1 style={{ fontSize: "1.6rem", margin: 0 }}>{branding.companyName ? `${branding.companyName} Status` : "Service Status"}</h1>
        </div>
        <p style={{ color: "#666", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
          Last updated {new Date(data.generatedAt).toLocaleString()}
        </p>

        <div
          style={{
            padding: "1rem 1.25rem",
            borderRadius: 10,
            marginBottom: "2rem",
            background: allOperational ? "#f0fdf4" : downCount > 0 ? "#fef2f2" : "#fffbeb",
            border: `1px solid ${allOperational ? "#bbf7d0" : downCount > 0 ? "#fecaca" : "#fde68a"}`,
            color: allOperational ? "#166534" : downCount > 0 ? "#991b1b" : "#92400e",
            fontWeight: 600,
          }}
        >
          {allOperational ? "All Systems Operational" : downCount > 0 ? `${downCount} system(s) down` : `${degradedCount} system(s) experiencing degraded performance`}
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: "2rem" }}>
          {data.monitors.length === 0 ? (
            <p style={{ padding: "1rem 1.25rem", color: "#666", fontSize: "0.85rem", margin: 0 }}>No services are published on this status page.</p>
          ) : (
            data.monitors.map((m, i) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.9rem 1.25rem",
                  borderTop: i === 0 ? "none" : "1px solid #f0f0f0",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{m.name}</div>
                  <div style={{ fontSize: "0.78rem", color: "#888" }}>{m.hostname}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[m.status], display: "inline-block" }} />
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: STATUS_COLOR[m.status] }}>{STATUS_LABEL[m.status]}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Incident History (last 30 days)</h2>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          {data.recentIncidents.length === 0 ? (
            <p style={{ padding: "1rem 1.25rem", color: "#666", fontSize: "0.85rem", margin: 0 }}>No incidents in the last 30 days.</p>
          ) : (
            data.recentIncidents.map((inc, i) => (
              <div key={i} style={{ padding: "0.8rem 1.25rem", borderTop: i === 0 ? "none" : "1px solid #f0f0f0", fontSize: "0.85rem" }}>
                <strong>{inc.monitorName}</strong> &mdash; {inc.resolvedAt ? "Resolved" : "Ongoing"} ({formatDuration(inc.startedAt, inc.resolvedAt)})
                <div style={{ color: "#888", fontSize: "0.78rem" }}>
                  Started {new Date(inc.startedAt).toLocaleString()}
                  {inc.resolvedAt ? ` · Resolved ${new Date(inc.resolvedAt).toLocaleString()}` : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
