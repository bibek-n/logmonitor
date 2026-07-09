import ToolForm from "@/components/ToolForm";

export default function Ipv6TestPage() {
  return (
    <div>
      <h1>IPv6 Test</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Checks whether this server has working IPv6 connectivity by comparing an IPv4-only lookup against an
        IPv6-capable one — if the IPv6-capable endpoint falls back to an IPv4 address, this server has no working
        IPv6 route.
      </p>
      <ToolForm endpoint="/api/whatismyip/ipv6-test" submitLabel="Run IPv6 Test" fields={[]} />
    </div>
  );
}
