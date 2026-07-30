import PortScannerForm from "@/components/PortScannerForm";

export default function PortScannerPage() {
  return (
    <div>
      <h1>Port Scanner</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        TCP and UDP port scanning with banner grabbing, run from this server - use Internal for
        LAN addresses and External for public IPs/hostnames you control. Only scan systems you're
        authorized to test.
      </p>
      <PortScannerForm />
    </div>
  );
}
