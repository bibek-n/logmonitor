import { getAutomationSession } from "@/lib/requireAutomationPermission";
import { SchedulesClient } from "@/components/automation/SchedulesClient";

export const dynamic = "force-dynamic";

export default async function AutomationSchedulesPage() {
  const automation = await getAutomationSession("auto_view");
  if (!automation) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Scheduled Jobs</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view Scheduled Jobs.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Scheduled Jobs</h1>
      <SchedulesClient />
    </div>
  );
}
