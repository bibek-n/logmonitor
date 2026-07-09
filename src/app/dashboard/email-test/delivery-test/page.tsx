import ToolForm from "@/components/ToolForm";

export default function DeliveryTestPage() {
  return (
    <div>
      <h1>Email Delivery Test</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Actually sends a real test email through an SMTP server you authenticate to, and reports whether the server
        accepted it for delivery. Credentials are used only for this one send — nothing is saved. Acceptance by the
        SMTP server doesn&apos;t guarantee inbox delivery, so check the destination mailbox (including spam) too.
      </p>
      <ToolForm
        endpoint="/api/email-test/delivery"
        submitLabel="Send Test Email"
        fields={[
          { name: "smtpHost", label: "SMTP Host", placeholder: "e.g. smtp.mandrillapp.com", required: true },
          { name: "smtpPort", label: "Port", placeholder: "587", defaultValue: "587" },
          { name: "username", label: "Username", placeholder: "SMTP username", required: true },
          { name: "password", label: "Password", type: "password", placeholder: "SMTP password", required: true },
          { name: "from", label: "From", placeholder: "sender@example.com", required: true },
          { name: "to", label: "To", placeholder: "recipient@example.com", required: true },
        ]}
      />
    </div>
  );
}
