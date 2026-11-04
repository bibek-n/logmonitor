import Link from "next/link";
import { getOffboardingSession } from "@/lib/requireOffboardingPermission";
import { OffboardingDashboardClient } from "@/components/offboarding/OffboardingDashboardClient";

export const dynamic = "force-dynamic";

export default async function OffboardingPage() {
  const off = await getOffboardingSession("off_view");
  if (!off) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Employee Offboarding</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Employee Offboarding.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: "0.25rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Employee Offboarding</h1>
        <Link href="/dashboard/offboarding/settings" style={{ fontSize: "0.85rem", color: "var(--primary)" }}>
          GitLab, Glesys, AgentQA &amp; Teamwork Settings
        </Link>
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Map each employee to their GitLab account and Glesys mailbox (AgentQA and Teamwork match by email
        automatically), then use Disable All to revoke access across all four. Nothing is ever deleted - GitLab
        users are blocked (reversible via unblock), Glesys mailboxes get a fresh password only an admin can
        retrieve, AgentQA sign-in is switched off (reversible by re-enabling), and Teamwork sign-in is switched off
        (reversible in principle, but re-enabling currently needs a manual step there - no restore endpoint is
        documented yet).
      </p>
      <OffboardingDashboardClient />
    </div>
  );
}
