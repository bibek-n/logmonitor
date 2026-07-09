import NetworkToolForm from "@/components/NetworkToolForm";

export default function MtrPage() {
  return (
    <div>
      <h1>MTR Tool</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Combines traceroute and ping: traces the path to a target, then pings every hop a few times to show
        per-hop packet loss and latency. This is a single-pass snapshot (not a continuously updating live view like
        the classic Linux <code>mtr</code>), so re-run it if you want a fresh sample — can take up to ~30 seconds.
      </p>
      <NetworkToolForm
        endpoint="/api/tools/mtr"
        targetLabel="Target"
        targetPlaceholder="e.g. 192.168.1.1, 8.8.8.8, or google.com"
      />
    </div>
  );
}
