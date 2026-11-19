import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireWordpressScanPermission, isWordpressScanSession } from "@/lib/requireWordpressScanPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { runWordPressDeepScan } from "@/lib/wordpressScan/runScan";
import { saveWordPressScan } from "@/lib/wordpressScan/persist";
import { isScanProfile } from "@/lib/wordpressScan/shared";

interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
  PhpVersion: string | null;
}

export interface AllSitesScanResultEntry {
  websiteId: number;
  name: string;
  url: string;
  scanId: number;
  isWordPress: boolean;
  blockReason: string | null;
  coreVersion: string | null;
  latestCoreVersion: string | null;
  phpVersion: string | null;
  corePhpRequirement: string | null;
  pluginCount: number;
  findingCount: number;
  riskLevel: string;
  error: string | null;
}

// Bulk twin of the single-site scan in cli/route.ts - runs every WordPress site from the
// Websites list (same Platform = 'WordPress' source the website picker now uses) through the
// same runWordPressDeepScan() sequentially, same non-concurrent reasoning as the Websites
// list's own "Scan All" (src/app/dashboard/audit/websites/actions.ts): this doesn't fire
// dozens of concurrent outbound requests at a company's own and third-party servers at once.
// Streams one line per site plus a final __ALLDONE__ sentinel carrying every site's summary,
// so the client can render an aggregate table without a second round trip.
export async function POST(req: NextRequest) {
  const admin = await requireWordpressScanPermission("wps_scan");
  if (!isWordpressScanSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const profile = isScanProfile(body?.profile) ? body.profile : "comprehensive";
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (line: string) => controller.enqueue(encoder.encode(line + "\n"));

      try {
        const db = await getDb();
        const sites = await db.query<WebsiteRow>(
          `SELECT Id, Name, Url, PhpVersion FROM Websites WHERE Enabled = 1 AND Platform = 'WordPress' ORDER BY Name`
        );

        emit(`[*] Scanning ${sites.recordset.length} WordPress site(s)...`);
        const results: AllSitesScanResultEntry[] = [];

        for (let i = 0; i < sites.recordset.length; i++) {
          const site = sites.recordset[i];
          emit(`[*] (${i + 1}/${sites.recordset.length}) Scanning ${site.Name} (${site.Url}) ...`);
          try {
            const report = await runWordPressDeepScan(site.Url, undefined, site.PhpVersion, profile);
            const scanId = await saveWordPressScan(report, site.Id, admin);
            results.push({
              websiteId: site.Id,
              name: site.Name,
              url: site.Url,
              scanId,
              isWordPress: report.isWordPress,
              blockReason: report.blockReason,
              coreVersion: report.coreVersion,
              latestCoreVersion: report.latestCoreVersion,
              phpVersion: report.phpVersion,
              corePhpRequirement: report.corePhpRequirement,
              pluginCount: report.plugins.length,
              findingCount: report.findings.length,
              riskLevel: report.riskLevel,
              error: null,
            });
            emit(
              report.isWordPress
                ? `[+] ${site.Name}: risk=${report.riskLevel}, core=${report.coreVersion ?? "unknown"}${report.latestCoreVersion ? ` (latest ${report.latestCoreVersion})` : ""}, ${report.plugins.length} plugin(s), ${report.findings.length} finding(s)`
                : report.blockReason
                  ? `[!] ${site.Name}: scan blocked - ${report.blockReason}`
                  : `[-] ${site.Name}: WordPress not confirmed at this URL`
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : "Scan failed.";
            results.push({
              websiteId: site.Id,
              name: site.Name,
              url: site.Url,
              scanId: 0,
              isWordPress: false,
              blockReason: null,
              coreVersion: null,
              latestCoreVersion: null,
              phpVersion: site.PhpVersion,
              corePhpRequirement: null,
              pluginCount: 0,
              findingCount: 0,
              riskLevel: "unknown",
              error: message,
            });
            emit(`[!] ${site.Name}: ${message}`);
          }
          emit(`__SITE_PROGRESS__${i + 1}/${sites.recordset.length}`);
        }

        emit(`[*] All sites scanned.`);
        emit(`__ALLDONE__${JSON.stringify(results)}`);
        await logAdminAction({ admin, section: "wordpress-scan", action: "scan_all", details: `${sites.recordset.length} sites`, ipAddress: clientIp });
      } catch (err) {
        emit(`[!] Scan-all failed: ${err instanceof Error ? err.message : "unknown error"}`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
