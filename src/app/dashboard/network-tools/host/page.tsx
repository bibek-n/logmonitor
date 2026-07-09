import NetworkToolForm from "@/components/NetworkToolForm";

export default function HostPage() {
  return (
    <div>
      <h1>Host</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Quick lookup: enter a hostname or domain to get its IP address(es), or an IP to get its reverse DNS (PTR)
        hostname if one is set.
      </p>
      <NetworkToolForm
        endpoint="/api/tools/host"
        targetLabel="Hostname, domain, or IP"
        targetPlaceholder="e.g. google.com or 8.8.8.8"
      />
    </div>
  );
}
