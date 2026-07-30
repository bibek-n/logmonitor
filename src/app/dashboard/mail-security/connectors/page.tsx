import { getMailSession } from "@/lib/requireMailPolicyPermission";
import { ConnectorsClient } from "@/components/mailSecurity/ConnectorsClient";

export const dynamic = "force-dynamic";

export default async function MailConnectorsPage() {
  const mail = await getMailSession("mail_view");
  if (!mail) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Mail Connectors</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Mail Protection.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Mail Connectors</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Stage 1 only - no provider adapter is implemented yet. Saving a connection and clicking &quot;Test&quot; will
        honestly report &quot;not connected&quot; until a real M365/Google Workspace/Exchange/SMTP-IMAP adapter is
        wired up in a later stage, once tenant admin consent or mailbox credentials are available.
      </p>
      <ConnectorsClient />
    </div>
  );
}
