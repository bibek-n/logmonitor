import { getDeviceAnomalies } from "@/lib/anomalyDetection";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function AnomaliesPage() {
  const anomalies = await getDeviceAnomalies();

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Anomaly Detection</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Devices currently running well above their own historical baseline (trailing 14 days) — not a fixed threshold, so this catches a
        quiet device suddenly spiking even when it never crosses the usual 90% alert line.
      </p>
      <Card>
        {anomalies.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No anomalies detected right now. Everything is within its normal range.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Device</th>
                  <th style={{ padding: "0.4rem" }}>Metric</th>
                  <th style={{ padding: "0.4rem" }}>Current</th>
                  <th style={{ padding: "0.4rem" }}>Normal Baseline</th>
                  <th style={{ padding: "0.4rem" }}>When</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{a.device}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <Badge tone="warning">{a.metric === "cpu" ? "CPU" : "Memory"}</Badge>
                    </td>
                    <td style={{ padding: "0.4rem", fontWeight: 600 }}>{a.current.toFixed(1)}%</td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>
                      {a.baselineAvg.toFixed(1)}% ± {a.baselineStdev.toFixed(1)}%
                    </td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{new Date(a.sampledAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
