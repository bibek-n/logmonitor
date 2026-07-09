import ToolForm from "@/components/ToolForm";

export default function BlacklistCheckPage() {
  return (
    <div>
      <h1>Blacklist Check</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Checks whether an IPv4 address is listed on major spam blacklists (Spamhaus ZEN, SpamCop, Barracuda, SORBS,
        PSBL) — a listing here is one of the most common reasons legitimate traffic gets rejected or flagged.
      </p>
      <ToolForm
        endpoint="/api/whatismyip/blacklist-check"
        fields={[{ name: "ip", label: "IPv4 Address", placeholder: "e.g. 46.16.236.7", required: true }]}
      />
    </div>
  );
}
