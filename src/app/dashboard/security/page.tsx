import SecurityDashboardClient from "@/components/intrusionDetection/SecurityDashboardClient";

export const dynamic = "force-dynamic";

export default function SecurityDashboardPage() {
  return (
    <div>
      <h1>Intrusion Detection</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Monitors Sophos threat/web-filter events, login activity, and IIS access logs for suspicious activity, and
        raises explainable alerts. Every alert shows exactly which rule fired and why.
      </p>
      <SecurityDashboardClient />
    </div>
  );
}
