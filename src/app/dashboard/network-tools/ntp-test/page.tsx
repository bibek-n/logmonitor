import NetworkToolForm from "@/components/NetworkToolForm";

export default function NtpTestPage() {
  return (
    <div>
      <h1>NTP Server Test</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Query an NTP server (port 123) and report the time offset from this server&apos;s own clock — useful for
        verifying an NTP source is reachable and in sync before pointing devices at it.
      </p>
      <NetworkToolForm
        endpoint="/api/tools/ntp"
        targetLabel="NTP Server"
        targetPlaceholder="e.g. pool.ntp.org, time.windows.com, or 192.168.1.1"
      />
    </div>
  );
}
