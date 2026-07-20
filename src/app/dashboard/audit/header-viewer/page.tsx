import { getDb } from "@/lib/db";
import WebsiteToolForm from "@/components/WebsiteToolForm";

export const dynamic = "force-dynamic";

export default async function HeaderViewerPage() {
  const db = await getDb();
  const result = await db.query<{ Id: number; Name: string; Url: string }>(
    `SELECT Id, Name, Url FROM Websites WHERE Enabled = 1 ORDER BY Name`
  );

  return (
    <div>
      <h1>HTTP / HTTPS Response Header Viewer</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Shows every response header returned by a site — useful for checking security headers (Strict-Transport-Security,
        X-Frame-Options, Content-Security-Policy), caching behavior, and server identification.
      </p>
      <WebsiteToolForm endpoint="/api/audit/header-viewer" savedWebsites={result.recordset} />
    </div>
  );
}
