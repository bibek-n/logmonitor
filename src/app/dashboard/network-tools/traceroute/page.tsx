import NetworkToolForm from "@/components/NetworkToolForm";

export default function TraceroutePage() {
  return (
    <div>
      <h1>Traceroute</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Trace the hop-by-hop path to an internal IP, external public IP, or domain (up to 20 hops, 1s per-hop
        timeout). Can take up to ~20 seconds for distant or unreachable targets.
      </p>
      <NetworkToolForm
        endpoint="/api/tools/traceroute"
        targetLabel="Target"
        targetPlaceholder="e.g. 192.168.1.1, 8.8.8.8, or google.com"
      />
    </div>
  );
}
