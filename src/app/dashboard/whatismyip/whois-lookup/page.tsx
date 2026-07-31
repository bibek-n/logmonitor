import ToolForm from "@/components/ToolForm";

export default function WhoisLookupPage() {
  return (
    <div>
      <h1>WHOIS Lookup</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Queries the domain&apos;s (or IP&apos;s) authoritative WHOIS server directly and shows its raw response —
        registrar/organization, nameservers, creation/expiry/transfer dates, and status — the same output a
        command-line <code>whois</code> lookup would return. Some registries redact the registrant&apos;s personal
        details by policy; only what the registry itself publishes is ever shown here.
      </p>
      <ToolForm
        endpoint="/api/whatismyip/whois"
        fields={[{ name: "target", label: "Domain or IP Address", placeholder: "e.g. google.com or 8.8.8.8", required: true }]}
      />
    </div>
  );
}
