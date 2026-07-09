import NetworkToolForm from "@/components/NetworkToolForm";
import { NSLOOKUP_RECORD_TYPES } from "@/lib/networkTools";

export default function NslookupPage() {
  return (
    <div>
      <h1>Nslookup</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Query a specific DNS record type for a hostname or domain, optionally against a specific DNS server instead
        of this server&apos;s default resolver (e.g. 8.8.8.8 or 1.1.1.1). Use PTR with an IP target for reverse
        lookups.
      </p>
      <NetworkToolForm
        endpoint="/api/tools/nslookup"
        targetLabel="Hostname, domain, or IP (for PTR)"
        targetPlaceholder="e.g. google.com or 8.8.8.8"
        recordTypes={NSLOOKUP_RECORD_TYPES}
        showServerField
      />
    </div>
  );
}
