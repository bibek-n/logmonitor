"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface MonitoringSummary {
  websitesUp: number;
  websitesDown: number;
  apisUp: number;
  apisDown: number;
  avgResponseMs: number | null;
  errorRatePct: number | null;
}

interface RecentIncident {
  title: string;
  severity: string;
  status: string;
  startedAt: string;
  resolvedAt: string | null;
}

export function StatusClient({
  monitoring,
  incidents,
  offlineDeviceCount,
  expiringSslCount,
}: {
  monitoring: MonitoringSummary;
  incidents: RecentIncident[];
  offlineDeviceCount: number;
  expiringSslCount: number;
}) {
  const totalDown = monitoring.websitesDown + monitoring.apisDown;
  const openIncidents = incidents.filter((i) => i.status !== "resolved" && i.status !== "Resolved").length;
  const allClear = totalDown === 0 && openIncidents === 0;

  return (
    <div className="flex flex-col gap-4">
      <Card
        style={{
          borderColor: allClear ? "var(--success, #16a34a)" : "var(--danger, #dc2626)",
          background: allClear ? "color-mix(in srgb, var(--success, #16a34a) 8%, transparent)" : "color-mix(in srgb, var(--danger, #dc2626) 8%, transparent)",
        }}
      >
        <div className="flex items-center gap-3">
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: allClear ? "var(--success, #16a34a)" : "var(--danger, #dc2626)", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--ink)" }}>
              {allClear ? "All Systems Operational" : "Attention Needed"}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
              {totalDown > 0 ? `${totalDown} monitored site/API down. ` : ""}
              {openIncidents > 0 ? `${openIncidents} open incident${openIncidents === 1 ? "" : "s"}.` : ""}
              {allClear ? "No down sites/APIs and no open incidents right now." : ""}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
        <Card>
          <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Websites</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>
            {monitoring.websitesUp} <span style={{ fontSize: "0.9rem", color: "var(--ink-muted)", fontWeight: 400 }}>up</span>
            {monitoring.websitesDown > 0 && <span style={{ color: "var(--danger)", fontSize: "0.9rem" }}> · {monitoring.websitesDown} down</span>}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>APIs</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>
            {monitoring.apisUp} <span style={{ fontSize: "0.9rem", color: "var(--ink-muted)", fontWeight: 400 }}>up</span>
            {monitoring.apisDown > 0 && <span style={{ color: "var(--danger)", fontSize: "0.9rem" }}> · {monitoring.apisDown} down</span>}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Avg Response (24h)</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>{monitoring.avgResponseMs ? `${Math.round(monitoring.avgResponseMs)} ms` : "—"}</div>
        </Card>
        <Card>
          <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Error Rate (24h)</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>{monitoring.errorRatePct !== null ? `${monitoring.errorRatePct.toFixed(1)}%` : "—"}</div>
        </Card>
        <Card>
          <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Devices Offline (24h)</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>{offlineDeviceCount}</div>
        </Card>
        <Card>
          <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>SSL Expiring (14d)</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>{expiringSslCount}</div>
        </Card>
      </div>

      <Card>
        <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.75rem" }}>Recent Incidents</h2>
        {incidents.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No incidents recorded.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {incidents.map((inc, i) => (
              <div key={i} className="flex items-center justify-between" style={{ padding: "0.5rem 0", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                <div>
                  <div style={{ fontSize: "0.88rem", color: "var(--ink)" }}>{inc.title}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
                    Started {new Date(inc.startedAt).toLocaleString()}
                    {inc.resolvedAt ? ` · Resolved ${new Date(inc.resolvedAt).toLocaleString()}` : ""}
                  </div>
                </div>
                <Badge tone={inc.status === "resolved" || inc.status === "Resolved" ? "success" : inc.severity === "critical" ? "danger" : "warning"}>
                  {inc.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
