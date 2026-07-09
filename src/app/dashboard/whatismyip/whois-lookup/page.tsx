import ToolForm from "@/components/ToolForm";

export default function WhoisLookupPage() {
  return (
    <div>
      <h1>WHOIS Lookup</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Looks up registration details for a domain (registrar, nameservers, creation/expiry dates) or an IP block
        (allocated range, network owner) via RDAP — the modern, structured replacement for legacy WHOIS.
      </p>
      <ToolForm
        endpoint="/api/whatismyip/whois"
        fields={[{ name: "target", label: "Domain or IP Address", placeholder: "e.g. google.com or 8.8.8.8", required: true }]}
      />
    </div>
  );
}
