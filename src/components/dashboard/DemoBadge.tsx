import { FlaskConical } from "lucide-react";

// Marks a widget that isn't backed by real monitoring in this app yet (Sophos threat-feed
// ingestion, VPN session tracking, and per-country traffic enrichment don't exist as data
// sources today). Never omit this on a widget showing placeholder numbers — the whole point
// is that nobody mistakes it for live telemetry.
export function DemoBadge() {
  return (
    <span
      title="Not backed by live monitoring yet — illustrative data only"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: "0.65rem",
        fontWeight: 600,
        padding: "0.15rem 0.45rem",
        borderRadius: 999,
        color: "var(--warning)",
        background: "color-mix(in srgb, var(--warning) 15%, transparent)",
        border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)",
        textTransform: "uppercase",
        letterSpacing: "0.02em",
      }}
    >
      <FlaskConical size={10} />
      Demo data
    </span>
  );
}
