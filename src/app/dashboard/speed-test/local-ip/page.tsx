import SpeedTestForm from "@/components/SpeedTestForm";

export default function LocalIpSpeedTestPage() {
  return (
    <div>
      <h1>Local IP Speed Test</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Measures ping, download, and upload speed from this server to a device on your own network (MikroTik or
        Sophos side), updating live as the test runs. Ping always works; download/upload only work if that IP is
        running a reachable web server — if it isn&apos;t, those two will simply report a connection failure while
        ping still succeeds.
      </p>
      <SpeedTestForm category="local-ip" freeTextLabel="Local IP Address" freeTextPlaceholder="e.g. 192.168.1.1" />
    </div>
  );
}
