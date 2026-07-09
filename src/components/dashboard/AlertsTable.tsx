import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { AlertRow } from "@/lib/alerts";

const SEVERITY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  warning: "warning",
  error: "danger",
  critical: "danger",
  alert: "danger",
  emergency: "danger",
};

export function AlertsTable({ alerts }: { alerts: AlertRow[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>Recent Alerts</h2>
          <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", margin: "0.2rem 0 0" }}>
            MikroTik warnings/errors and current DHCP conflicts — most recent first.
          </p>
        </div>
        <Link href="/dashboard/staff" style={{ color: "var(--primary)", fontSize: "0.82rem", textDecoration: "none" }}>
          View Staff &rarr;
        </Link>
      </div>

      {alerts.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No alerts logged.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem", color: "var(--ink-muted)", fontWeight: 500 }}>Time</th>
                <th style={{ padding: "0.5rem", color: "var(--ink-muted)", fontWeight: 500 }}>Severity</th>
                <th style={{ padding: "0.5rem", color: "var(--ink-muted)", fontWeight: 500 }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.55rem 0.5rem", whiteSpace: "nowrap", color: "var(--ink-secondary)" }}>
                    {new Date(a.EventTime).toLocaleString()}
                  </td>
                  <td style={{ padding: "0.55rem 0.5rem" }}>
                    <Badge tone={SEVERITY_TONE[a.Severity] ?? "neutral"}>{a.Severity}</Badge>
                  </td>
                  <td style={{ padding: "0.55rem 0.5rem", color: "var(--ink)" }}>{a.Detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
