import { getMailSession } from "@/lib/requireMailPolicyPermission";
import { PoliciesClient } from "@/components/mailSecurity/PoliciesClient";

export const dynamic = "force-dynamic";

export default async function MailPoliciesPage() {
  const mail = await getMailSession("mail_view");
  if (!mail) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>File Blocking Policies</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Mail Protection.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>File Blocking Policies</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Stage 1: no mail provider is connected yet, so nothing here touches real email. Use &quot;Test&quot; on a
        policy to run a simulated message through the real inspection and policy-evaluation engine - the same
        engine Stage 2 will wire up to a live mailbox.
      </p>
      <PoliciesClient />
    </div>
  );
}
