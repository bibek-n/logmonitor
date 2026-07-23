import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { DdosDetectionClient } from "@/components/ddosDetection/DdosDetectionClient";

export const dynamic = "force-dynamic";

export default async function DdosDetectionPage() {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>DDoS Detection</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view DDoS detection data.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>DDoS Detection</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        A focused view over Intrusion Detection&apos;s own event/alert data - request volume over time, source IPs
        tagged for high request rate or bot-like activity, a tracked blocklist, and a combined timeline of both.
      </p>
      <DdosDetectionClient />
    </div>
  );
}
