import NetworkToolForm from "@/components/NetworkToolForm";

export default function PingPage() {
  return (
    <div>
      <h1>Ping</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Test reachability and round-trip latency to an internal IP, external public IP, or domain — run from this
        server, so results reflect what this server can reach (not necessarily every device on the LAN).
      </p>
      <NetworkToolForm
        endpoint="/api/tools/ping"
        targetLabel="Target"
        targetPlaceholder="e.g. 192.168.1.1, 8.8.8.8, or google.com"
      />
    </div>
  );
}
