import { getDb } from "@/lib/db";
import WebsiteToolForm from "@/components/WebsiteToolForm";

export const dynamic = "force-dynamic";

export default async function GaTagFinderPage() {
  const db = await getDb();
  const result = await db.query<{ Id: number; Name: string; Url: string }>(
    `SELECT Id, Name, Url FROM Websites ORDER BY Name`
  );

  return (
    <div>
      <h1>GA Tag Finder</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Scans a page&apos;s HTML for Google Analytics 4 (G-...), legacy Universal Analytics (UA-...), and Google
        Tag Manager (GTM-...) IDs, plus which tracking scripts are present. Only scans the initial HTML — tags
        injected purely by client-side JavaScript after page load won&apos;t be detected.
      </p>
      <WebsiteToolForm endpoint="/api/audit/ga-tag-finder" savedWebsites={result.recordset} />
    </div>
  );
}
