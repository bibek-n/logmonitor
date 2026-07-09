import NetworkToolForm from "@/components/NetworkToolForm";

export default function ReverseDnsPage() {
  return (
    <div>
      <h1>Reverse DNS Tool</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Look up the PTR (reverse DNS) hostname for an internal or public IP address. For a combined forward/reverse
        tool see Host; this one is dedicated to reverse (IP &rarr; hostname) lookups only.
      </p>
      <NetworkToolForm
        endpoint="/api/tools/reverse-dns"
        targetLabel="IP Address"
        targetPlaceholder="e.g. 192.168.1.1 or 8.8.8.8"
      />
    </div>
  );
}
