import { getDb } from "@/lib/db";
import WebsiteToolForm from "@/components/WebsiteToolForm";

export const dynamic = "force-dynamic";

export default async function HealthCheckPage() {
  const db = await getDb();
  const result = await db.query<{ Id: number; Name: string; Url: string }>(
    `SELECT Id, Name, Url FROM Websites WHERE Enabled = 1 ORDER BY Name`
  );

  return (
    <div>
      <h1>Website Health Check</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Checks whether a site is up, its HTTP status, response time, and page title — run from this server, so a
        result of &quot;down&quot; means unreachable from here specifically.
      </p>
      <WebsiteToolForm endpoint="/api/audit/health-check" savedWebsites={result.recordset} />
    </div>
  );
}
