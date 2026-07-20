import { getDb } from "@/lib/db";
import WebsiteToolForm from "@/components/WebsiteToolForm";

export const dynamic = "force-dynamic";

export default async function SslCheckerPage() {
  const db = await getDb();
  const result = await db.query<{ Id: number; Name: string; Url: string }>(
    `SELECT Id, Name, Url FROM Websites WHERE Enabled = 1 ORDER BY Name`
  );

  return (
    <div>
      <h1>SSL/TLS Certificate Checker</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Connects on port 443 (or the port in the URL) and reports the certificate&apos;s subject, issuer, validity
        dates, days until expiry, TLS protocol version, and whether the chain is trusted — even for expired or
        untrusted certificates, so you can see exactly what&apos;s wrong.
      </p>
      <WebsiteToolForm endpoint="/api/audit/ssl-checker" savedWebsites={result.recordset} />
    </div>
  );
}
