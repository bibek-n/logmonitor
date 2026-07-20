import { getDb } from "@/lib/db";
import ThreatScannerClient, { type WebsiteOption } from "@/components/threatScanner/ThreatScannerClient";

export const dynamic = "force-dynamic";

export default async function ThreatScannerPage() {
  const db = await getDb();
  const websitesResult = await db.query<WebsiteOption>("SELECT Id, Name, Url FROM Websites WHERE Enabled = 1 ORDER BY Name");

  return (
    <div>
      <h1>Threat Scanner</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Analyze suspicious files, URLs, IP addresses, and domains against ~70 antivirus engines via VirusTotal.
      </p>
      <ThreatScannerClient websites={websitesResult.recordset} />
    </div>
  );
}
