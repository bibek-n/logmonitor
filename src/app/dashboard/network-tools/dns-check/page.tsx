import NetworkToolForm from "@/components/NetworkToolForm";

export default function DnsCheckPage() {
  return (
    <div>
      <h1>DNS Check</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Checks A, AAAA, MX, TXT, NS, CNAME, and SOA records for a domain in one pass — useful for verifying mail
        (SPF/DKIM in TXT, MX) or general DNS setup at a glance.
      </p>
      <NetworkToolForm endpoint="/api/tools/dns-check" targetLabel="Domain" targetPlaceholder="e.g. websearchpro.net" />
    </div>
  );
}
