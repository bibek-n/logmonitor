import ToolForm from "@/components/ToolForm";

export default function IpLookupPage() {
  return (
    <div>
      <h1>IP Lookup</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Looks up ISP, organization, ASN, and approximate geolocation for any IP address or hostname.
      </p>
      <ToolForm
        endpoint="/api/whatismyip/ip-lookup"
        fields={[{ name: "target", label: "IP Address or Hostname", placeholder: "e.g. 8.8.8.8 or google.com", required: true }]}
      />
    </div>
  );
}
