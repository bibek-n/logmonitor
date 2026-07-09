import ToolForm from "@/components/ToolForm";

export default function DnsblLookupPage() {
  return (
    <div>
      <h1>DNSBL Spam Database Lookup</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Checks whether an IP address is listed on major DNS-based blackhole lists (Spamhaus ZEN, SpamCop,
        Barracuda, SORBS, PSBL) — a listing here is one of the most common reasons legitimate mail gets rejected
        or spam-foldered.
      </p>
      <ToolForm
        endpoint="/api/email-test/dnsbl"
        fields={[{ name: "ip", label: "IP Address", placeholder: "e.g. 46.16.236.7", required: true }]}
      />
    </div>
  );
}
