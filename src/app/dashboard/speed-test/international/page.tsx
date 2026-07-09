import SpeedTestForm from "@/components/SpeedTestForm";
import { INTERNATIONAL_SERVERS } from "@/lib/speedTest";

export default function InternationalSpeedTestPage() {
  return (
    <div>
      <h1>International Server Speed Test</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Measures ping, download, and upload speed from this server to a global test server, updating live as the
        test runs. Cloudflare is a purpose-built, officially documented endpoint; the rest are real ISP speed-test
        servers (Sweden, UK, Germany, Singapore, Japan, India, France, Australia, Canada, US) discovered via
        Ookla&apos;s public server list and verified to support both download and upload.
      </p>
      <SpeedTestForm category="international" servers={INTERNATIONAL_SERVERS} />
    </div>
  );
}
