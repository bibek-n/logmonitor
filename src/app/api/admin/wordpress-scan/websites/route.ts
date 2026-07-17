import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { detectWordPress } from "@/lib/wordpressScan/detect";

interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
}

// Live-detects which registered websites are WordPress, rather than relying on a stored
// flag — the fastest way for this to go stale would be a site switching CMS, and this list
// is only ever fetched on-demand (not polled), so a live check per page-load is cheap
// enough and always accurate.
export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<WebsiteRow>(`SELECT Id, Name, Url FROM Websites WHERE Enabled = 1 ORDER BY Name`);

  const checked = await Promise.all(
    result.recordset.map(async (site) => {
      try {
        const detection = await detectWordPress(site.Url);
        return { ...site, isWordPress: detection.isWordPress };
      } catch {
        return { ...site, isWordPress: false };
      }
    })
  );

  return NextResponse.json({ ok: true, data: checked.filter((s) => s.isWordPress) });
}
