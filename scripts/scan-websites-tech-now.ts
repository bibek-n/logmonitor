import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import {
  extractPhpVersion,
  detectPlatform,
  extractWordPressVersion,
  extractServerHeaderVersion,
} from "../src/lib/websiteSecurityAudit/platformDetect";
import { detectNextJsVersionViaBrowser } from "../src/lib/websiteSecurityAudit/nextjsVersionBrowserDetect";
import { detectWordPressVersionFallback } from "../src/lib/websiteSecurityAudit/wordpressVersionFallbackDetect";

// Ad-hoc, run-from-the-command-line twin of scanAllPhpVersions() in
// src/app/dashboard/audit/websites/actions.ts - same selection (Enabled, not
// PhpVersionManual), same per-row UPDATE (Platform/PlatformVersion still protected by
// PlatformVersionManual), just without the Next.js server-action/redirect plumbing so it can
// run outside a request (e.g. right after a deploy, to populate the new Next.js version
// detection immediately instead of waiting for someone to click "Scan All" in the UI).
const SCAN_TIMEOUT_MS = 25000;
const SCAN_UA = "LogMonitor-WebsiteSecurityAudit/1.0 (+authorized-scan)";

interface ScanResult {
  phpVersion: string | null;
  platform: string | null;
  platformVersion: string | null;
  serverHeader: string | null;
  scanError: string | null;
}

async function scanOne(url: string, skipPlatformVersionDetect: boolean): Promise<ScanResult> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
      headers: { "User-Agent": SCAN_UA },
    });
    const html = await res.text();
    const platform = await detectPlatform(html, res.headers);
    let platformVersion = platform === "WordPress" ? extractWordPressVersion(html) : null;
    if (platform === "WordPress" && !platformVersion && !skipPlatformVersionDetect) {
      platformVersion = await detectWordPressVersionFallback(html, url);
    }
    if (platform === "Next.js" && !skipPlatformVersionDetect) {
      platformVersion = await detectNextJsVersionViaBrowser(url);
    }
    return {
      phpVersion: extractPhpVersion(res.headers),
      platform: platform === "Other" ? null : platform,
      platformVersion,
      serverHeader: extractServerHeaderVersion(res.headers),
      scanError: null,
    };
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { phpVersion: null, platform: null, platformVersion: null, serverHeader: null, scanError: isTimeout ? "Timed out" : "Unreachable" };
  }
}

async function main() {
  const db = await getDb();
  const result = await db.query<{ Id: number; Name: string; Url: string; PlatformVersionManual: boolean }>(
    `SELECT Id, Name, Url, PlatformVersionManual FROM Websites WHERE Enabled = 1 AND PhpVersionManual = 0`
  );

  console.log(`Scanning ${result.recordset.length} enabled site(s)...`);
  for (const site of result.recordset) {
    const r = await scanOne(site.Url, site.PlatformVersionManual);
    await db
      .request()
      .input("id", sql.Int, site.Id)
      .input("phpVersion", sql.NVarChar, r.phpVersion)
      .input("platform", sql.NVarChar, r.platform)
      .input("platformVersion", sql.NVarChar, r.platformVersion)
      .input("serverHeader", sql.NVarChar, r.serverHeader)
      .input("scanError", sql.NVarChar, r.scanError)
      .query(
        `UPDATE Websites SET PhpVersion = @phpVersion,
           Platform = CASE WHEN PlatformVersionManual = 1 THEN Platform ELSE @platform END,
           PlatformVersion = CASE WHEN PlatformVersionManual = 1 THEN PlatformVersion ELSE @platformVersion END,
           ServerHeader = @serverHeader, PhpVersionScanError = @scanError, PhpVersionCheckedAt = SYSUTCDATETIME(),
           PhpVersionManual = 0
         WHERE Id = @id`
      );
    console.log(
      `${site.Name} (${site.Url}) -> platform=${r.platform ?? "-"} version=${r.platformVersion ?? "-"} php=${r.phpVersion ?? "-"} error=${r.scanError ?? "-"}`
    );
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
