import { getDb, sql } from "@/lib/db";

interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
}

// Keeps SecurityProtectedApplications in sync with the app's existing Websites list (the
// same registry Security Headers, WP Scan, and Website Speed & Performance already read
// from - "Audit Websites & SSL Certificates" in the nav) so IDS never maintains its own,
// second copy of "which websites do we monitor." Runs at the top of every collection pass:
// websites added/removed/renamed via the existing website admin page show up in IDS within
// one collection interval, with no separate sync task to schedule.
export async function syncProtectedWebsites(): Promise<void> {
  const db = await getDb();

  const websites = await db.query<WebsiteRow>`SELECT Id, Name, Url FROM Websites WHERE Enabled = 1`;
  for (const site of websites.recordset) {
    await db
      .request()
      .input("websiteId", sql.Int, site.Id)
      .input("name", sql.NVarChar, site.Name)
      .input("url", sql.NVarChar, site.Url)
      .query(`
        IF EXISTS (SELECT * FROM SecurityProtectedApplications WHERE WebsiteId = @websiteId)
          UPDATE SecurityProtectedApplications SET Name = @name, BaseUrl = @url, IsActive = 1 WHERE WebsiteId = @websiteId
        ELSE
          INSERT INTO SecurityProtectedApplications (Name, AppType, BaseUrl, WebsiteId, Notes)
          VALUES (@name, 'WebApp', @url, @websiteId, 'Synced from the Websites list (Audit Websites & SSL Certificates).')
      `);
  }

  // A website that was disabled/removed loses its protected-application row's active status,
  // never the row itself - historical events/alerts tied to it stay intact and queryable.
  await db.query`
    UPDATE SecurityProtectedApplications
    SET IsActive = 0
    WHERE WebsiteId IS NOT NULL
      AND WebsiteId NOT IN (SELECT Id FROM Websites WHERE Enabled = 1)
      AND IsActive = 1
  `;
}

export interface WebsiteAppMatch {
  protectedApplicationId: number;
  hostname: string;
}

// Builds a hostname -> protectedApplicationId lookup for every active, website-backed
// protected application, so log adapters that see a domain (e.g. Sophos web-filter events)
// can attribute an event to the specific website it targeted instead of a generic firewall
// bucket. Invalid/unparseable BaseUrl values are skipped rather than throwing.
export async function loadWebsiteAppsByHostname(): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.query<{ Id: number; BaseUrl: string }>`
    SELECT Id, BaseUrl FROM SecurityProtectedApplications WHERE WebsiteId IS NOT NULL AND IsActive = 1 AND BaseUrl IS NOT NULL
  `;

  const map = new Map<string, number>();
  for (const row of rows.recordset) {
    try {
      const hostname = new URL(row.BaseUrl).hostname.toLowerCase().replace(/^www\./, "");
      if (hostname) map.set(hostname, row.Id);
    } catch {
      // BaseUrl wasn't a parseable absolute URL - skip, this app just won't get
      // domain-matched web-filter events (it's still visible/filterable in the dashboard).
    }
  }
  return map;
}
