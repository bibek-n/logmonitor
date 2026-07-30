import { getMailSession } from "@/lib/requireMailPolicyPermission";
import { ExceptionsClient } from "@/components/mailSecurity/ExceptionsClient";

export const dynamic = "force-dynamic";

export default async function MailExceptionsPage() {
  const mail = await getMailSession("mail_view");
  if (!mail) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Exceptions</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Mail Protection.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Exceptions</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Trusted senders, approved extensions, approved hashes, and similar allowlist entries. Every exception
        requires a reason and can carry an expiry - it is auditable and can never override a Mandatory policy.
      </p>
      <ExceptionsClient />
    </div>
  );
}
