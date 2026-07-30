import { getMailSession } from "@/lib/requireMailPolicyPermission";
import { TemplatesClient } from "@/components/mailSecurity/TemplatesClient";

export const dynamic = "force-dynamic";

export default async function MailTemplatesPage() {
  const mail = await getMailSession("mail_view");
  if (!mail) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Notification Templates</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Mail Protection.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Notification Templates</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Edit the subject/body sent for each event type. Use {"{{variable}}"} placeholders - sender, recipient,
        subject, file_name, detected_type, policy_name, block_reason, incident_id, timestamp, support_email.
        Never include confidential file content or internal scan details here.
      </p>
      <TemplatesClient />
    </div>
  );
}
