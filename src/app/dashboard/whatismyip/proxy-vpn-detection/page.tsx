import ToolForm from "@/components/ToolForm";

export default function ProxyVpnDetectionPage() {
  return (
    <div>
      <h1>Proxy / VPN Detection</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Checks whether an IP is associated with a known proxy, VPN provider, or hosting/datacenter network rather
        than a typical residential or business connection. This is a heuristic based on known IP ranges and ASN
        data — it can identify where a connection exits from, but can&apos;t see inside an encrypted VPN tunnel.
      </p>
      <ToolForm
        endpoint="/api/whatismyip/proxy-vpn-detection"
        fields={[{ name: "target", label: "IP Address or Hostname", placeholder: "e.g. 8.8.8.8", required: true }]}
      />
    </div>
  );
}
