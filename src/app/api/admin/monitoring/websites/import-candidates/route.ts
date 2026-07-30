import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { listMonitoredUrls } from "@/lib/websiteApiMonitoring/repository";

interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
  Environment: string;
}

// Read-only lookup into the pre-existing Website Management "Websites" list, so a Website
// Monitor can be created by picking an already-known site instead of retyping its URL. This
// never writes to Websites and Websites' own features never read Monitors - the two stay
// independent, per the explicit "do not take over the existing Websites feature" requirement.
// Only Live sites are offered here - Staging/Dev environments aren't meant to be monitored
// for uptime the same way production is, per the user's explicit "live website only" request.
export async function GET() {
  const mon = await requireMonitoringPermission("mon_website_create");
  if (!isMonitoringSession(mon)) return mon;

  const db = await getDb();
  const [websites, monitoredUrls] = await Promise.all([
    db.query<WebsiteRow>("SELECT Id, Name, Url, Environment FROM Websites WHERE Enabled = 1 AND Environment = 'Live' ORDER BY Name ASC"),
    listMonitoredUrls(),
  ]);

  const candidates = websites.recordset.filter((w) => !monitoredUrls.has(w.Url.toLowerCase()));
  return NextResponse.json({ ok: true, data: candidates });
}
