import ToolForm from "@/components/ToolForm";

export default function MxTestPage() {
  return (
    <div>
      <h1>MX Mail Server Test</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Looks up a domain&apos;s MX records (in priority order) and tests whether each mail server is reachable on
        port 25 from this server.
      </p>
      <ToolForm
        endpoint="/api/email-test/mx"
        fields={[{ name: "domain", label: "Domain", placeholder: "e.g. websearchpro.net", required: true }]}
      />
    </div>
  );
}
