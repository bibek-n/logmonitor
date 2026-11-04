import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireWordpressScanPermission, isWordpressScanSession } from "@/lib/requireWordpressScanPermission";

interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
  PhpVersion: string | null;
}

// Reuses the Websites list's own Platform column instead of live-detecting WordPress here a
// second time - that column is already kept current by the Websites list's own Scan/Scan All
// buttons (src/app/dashboard/audit/websites/actions.ts), so this is instant and never drifts
// from what that list shows. The previous version of this route ran detectWordPress() against
// every enabled website on every page load (a full fetch per site, up to 15s timeout each),
// which is what made this page's site picker feel hung/broken with 100+ sites on the list.
export async function GET() {
  const admin = await requireWordpressScanPermission("wps_view");
  if (!isWordpressScanSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<WebsiteRow>(
    `SELECT Id, Name, Url, PhpVersion FROM Websites WHERE Enabled = 1 AND Platform = 'WordPress' ORDER BY Name`
  );

  return NextResponse.json({ ok: true, data: result.recordset.map((w) => ({ ...w, isWordPress: true })) });
}
