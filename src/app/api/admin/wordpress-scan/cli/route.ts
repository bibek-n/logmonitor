import { NextRequest } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireWordpressScanPermission, isWordpressScanSession } from "@/lib/requireWordpressScanPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { runWordPressDeepScan } from "@/lib/wordpressScan/runScan";
import { saveWordPressScan } from "@/lib/wordpressScan/persist";
import { isScanProfile } from "@/lib/wordpressScan/shared";

// Streams scan progress as plain text lines, one per check as it starts/finishes — the
// backing engine for the in-app CLI terminal. Ends with a `__REPORT__<json>` sentinel line
// so the terminal can offer a "view full report" link without a second round trip. Falls
// back gracefully if an intermediate proxy buffers the whole response: the terminal still
// gets every line, just all at once instead of incrementally.
export async function POST(req: NextRequest) {
  const admin = await requireWordpressScanPermission("wps_scan");
  if (!isWordpressScanSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const websiteId = body?.websiteId == null || body.websiteId === "" ? null : Number(body.websiteId);
  // The in-app CLI terminal never sends a profile (it's a fixed "scan wordpress <url>"
  // command) — the Report tab's form is the only caller that does, so it defaults here too.
  const profile = isScanProfile(body?.profile) ? body.profile : "comprehensive";

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (line: string) => controller.enqueue(encoder.encode(line + "\n"));

      if (!url) {
        emit("[!] Error: a URL is required. Usage: scan wordpress <url>");
        controller.close();
        return;
      }
      try {
        new URL(url);
      } catch {
        emit(`[!] Error: "${url}" doesn't look like a valid URL.`);
        controller.close();
        return;
      }

      try {
        let knownPhpVersion: string | null = null;
        if (Number.isInteger(websiteId) && websiteId > 0) {
          const db = await getDb();
          const row = await db
            .request()
            .input("id", sql.Int, websiteId)
            .query<{ PhpVersion: string | null }>("SELECT PhpVersion FROM Websites WHERE Id = @id");
          knownPhpVersion = row.recordset[0]?.PhpVersion ?? null;
        }
        const report = await runWordPressDeepScan(url, emit, knownPhpVersion);
        const scanId = await saveWordPressScan(report, Number.isInteger(websiteId) ? websiteId : null, admin);
        emit(`[*] Saved as scan #${scanId}.`);
        emit(`__REPORT__${JSON.stringify({ scanId, report })}`);
        await logAdminAction({ admin, section: "wordpress-scan", action: "cli_scan", details: url, ipAddress: clientIp });
      } catch (err) {
        emit(`[!] Scan failed: ${err instanceof Error ? err.message : "unknown error"}`);
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
