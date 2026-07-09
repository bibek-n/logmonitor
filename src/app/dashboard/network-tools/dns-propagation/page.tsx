import NetworkToolForm from "@/components/NetworkToolForm";
import { NSLOOKUP_RECORD_TYPES } from "@/lib/networkTools";

export default function DnsPropagationPage() {
  return (
    <div>
      <h1>DNS Propagation Checker</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Queries the same record across six major public resolvers (Google, Cloudflare, Quad9, OpenDNS, Verisign,
        Level3) side by side — useful right after a DNS change to see which resolvers have picked it up and which
        are still serving a cached/old value.
      </p>
      <NetworkToolForm
        endpoint="/api/tools/dns-propagation"
        targetLabel="Domain"
        targetPlaceholder="e.g. websearchpro.net"
        recordTypes={NSLOOKUP_RECORD_TYPES.filter((t) => t !== "PTR")}
      />
    </div>
  );
}
