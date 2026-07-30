import { getAutomationSession } from "@/lib/requireAutomationPermission";
import { ScriptsClient } from "@/components/automation/ScriptsClient";

export const dynamic = "force-dynamic";

export default async function AutomationScriptsPage() {
  const automation = await getAutomationSession("auto_view");
  if (!automation) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Scripts</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view Automation scripts.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Scripts</h1>
      <ScriptsClient />
    </div>
  );
}
