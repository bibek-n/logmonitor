import WordPressScanClient from "@/components/wordpressScan/WordPressScanClient";

export const dynamic = "force-dynamic";

export default function WordPressScanPage() {
  return (
    <div>
      <h1>WordPress Deep Scan</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Passive vulnerability scan for WordPress sites on your Websites list — core, theme &amp; plugin CVEs, WP-cron
        exposure, user enumeration &amp; XML-RPC, exposed config backups, and TimThumb. Runs entirely on this server;
        nothing is sent to a third party except a version/slug lookup against the WPScan vulnerability database, and
        only if that&apos;s configured.
      </p>
      <WordPressScanClient />
    </div>
  );
}
