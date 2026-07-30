import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { createWebsiteMonitorSchema } from "@/lib/websiteApiMonitoring/schema";
import { insertWebsiteMonitor, listMonitoredUrls } from "@/lib/websiteApiMonitoring/repository";

const importSchema = z.object({ websiteIds: z.array(z.number().int().positive()).min(1).max(100) });

interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
  Environment: string;
}

// Creates a Website Monitor for exactly the sites the admin ticked in the picker - never all
// of them automatically. Each new monitor gets the same defaults a manually-created one would
// (createWebsiteMonitorSchema's own .default()s), sourced only from the picked site's
// Name/Url/Environment; nothing about the source Websites row is modified.
export async function POST(req: NextRequest) {
  const mon = await requireMonitoringPermission("mon_website_create");
  if (!isMonitoringSession(mon)) return mon;

  const body = await req.json().catch(() => null);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid import payload" }, { status: 400 });
  }

  const db = await getDb();
  const ids = parsed.data.websiteIds;
  const idParams = ids.map((_, i) => `@id${i}`).join(",");
  const request = db.request();
  ids.forEach((id, i) => request.input(`id${i}`, sql.Int, id));
  const websites = await request.query<WebsiteRow>(`SELECT Id, Name, Url, Environment FROM Websites WHERE Enabled = 1 AND Id IN (${idParams})`);

  const monitoredUrls = await listMonitoredUrls();
  const created: { id: number; name: string; url: string }[] = [];
  const skipped: { name: string; url: string; reason: string }[] = [];

  for (const site of websites.recordset) {
    if (monitoredUrls.has(site.Url.toLowerCase())) {
      skipped.push({ name: site.Name, url: site.Url, reason: "Already has a website monitor." });
      continue;
    }
    try {
      const payload = createWebsiteMonitorSchema.parse({ name: site.Name, url: site.Url, environment: site.Environment });
      const monitorId = await insertWebsiteMonitor(payload, mon.userId);
      monitoredUrls.add(site.Url.toLowerCase());
      created.push({ id: monitorId, name: site.Name, url: site.Url });
    } catch (err) {
      // A single bad row (e.g. a Websites.Url that doesn't parse as a valid absolute URL)
      // must not 500 the whole batch and leave every other checked site un-imported.
      skipped.push({ name: site.Name, url: site.Url, reason: err instanceof Error ? err.message : "Could not create a monitor for this site." });
    }
  }

  if (created.length > 0) {
    await logAdminAction({
      admin: mon,
      section: "monitoring",
      action: "website_monitor_import",
      details: `Imported ${created.length} monitor(s) from Websites: ${created.map((c) => c.name).join(", ")}`,
      req,
    });
  }

  return NextResponse.json({ ok: true, data: { created, skipped } });
}
