import { getAutomationSession } from "@/lib/requireAutomationPermission";
import { JobDetailClient } from "@/components/automation/JobDetailClient";

export const dynamic = "force-dynamic";

export default async function AutomationTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const automation = await getAutomationSession("auto_view");
  const { id } = await params;
  if (!automation) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Task Output</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view Remote Tasks.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Task Output</h1>
      <JobDetailClient jobId={Number(id)} />
    </div>
  );
}
