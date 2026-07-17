import { getDb } from "@/lib/db";
import SecurityHeadersClient from "@/components/securityHeaders/SecurityHeadersClient";

export const dynamic = "force-dynamic";

export default async function SecurityHeadersPage() {
  const db = await getDb();
  const result = await db.query<{ Id: number; Name: string; Url: string }>(
    `SELECT Id, Name, Url FROM Websites WHERE Enabled = 1 ORDER BY Name`
  );

  return (
    <div>
      <h1>Security Headers</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Checks a site&apos;s HTTP response headers against the core security-header baseline (CSP, HSTS, X-Frame-Options,
        etc.), grades the result, and keeps a history of past scans.
      </p>
      <SecurityHeadersClient savedWebsites={result.recordset} />
    </div>
  );
}
