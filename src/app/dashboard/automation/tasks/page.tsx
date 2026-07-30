import { getAutomationSession } from "@/lib/requireAutomationPermission";
import { RemoteTasksClient } from "@/components/automation/RemoteTasksClient";

export const dynamic = "force-dynamic";

export default async function AutomationTasksPage() {
  const automation = await getAutomationSession("auto_view");
  if (!automation) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Remote Tasks</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view Remote Tasks.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Remote Tasks</h1>
      <RemoteTasksClient />
    </div>
  );
}
