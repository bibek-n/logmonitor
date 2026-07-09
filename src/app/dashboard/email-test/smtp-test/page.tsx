import ToolForm from "@/components/ToolForm";

export default function SmtpTestPage() {
  return (
    <div>
      <h1>SMTP Server Test</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Connects directly to a specific SMTP server and port, capturing its banner and EHLO response (supported
        extensions like STARTTLS, AUTH mechanisms, message size limits) — useful for testing a specific mail server,
        not just whatever a domain&apos;s MX records point to.
      </p>
      <ToolForm
        endpoint="/api/email-test/smtp"
        fields={[
          { name: "host", label: "SMTP Host", placeholder: "e.g. smtp.gmail.com", required: true },
          { name: "port", label: "Port", placeholder: "25", defaultValue: "25" },
        ]}
      />
    </div>
  );
}
