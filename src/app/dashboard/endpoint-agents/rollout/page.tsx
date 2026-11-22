import { getAdminSession } from "@/lib/requireAdmin";
import { AgentRolloutClient } from "@/components/endpointAgents/AgentRolloutClient";

export const dynamic = "force-dynamic";

export default async function AgentRolloutPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Agent Rollout</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can manage the agent rollout.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Agent Rollout</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Approve which agent release workstations and servers should update to.
      </p>
      <AgentRolloutClient />
    </div>
  );
}
