"use server";

import { getDb, sql } from "@/lib/db";
import { isValidUrl } from "@/lib/websiteTools";
import {
  extractPhpVersion,
  detectPlatform,
  extractWordPressVersion,
  extractServerHeaderVersion,
} from "@/lib/websiteSecurityAudit/platformDetect";
import { detectNextJsVersionViaBrowser } from "@/lib/websiteSecurityAudit/nextjsVersionBrowserDetect";
import { detectWordPressVersionFallback } from "@/lib/websiteSecurityAudit/wordpressVersionFallbackDetect";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const PHP_SCAN_TIMEOUT_MS = 25000;
const PHP_SCAN_UA = "LogMonitor-WebsiteSecurityAudit/1.0 (+authorized-scan)";

interface WebsiteTechScanResult {
  phpVersion: string | null;
  platform: string | null;
  platformVersion: string | null;
  serverHeader: string | null;
  // Short reason the fetch itself failed (timeout, DNS, TLS, refused, etc). Null means the
  // fetch succeeded - at that point null fields are real negatives (no PHP/x.y.z header, no
  // recognizable platform, ...), not "we don't know." Keeping these separate matters because
  // a timeout and "confirmed nothing found" look identical if you only look at the columns.
  scanError: string | null;
}

// One fetch covers PHP version, platform fingerprinting, and the raw Server header together,
// rather than three separate requests to the same URL for three separate columns. Next.js is
// the one platform that needs a second, heavier lookup (a real headless-browser page load,
// not just this fetch) because its version only shows up in a JS global, not the raw
// HTML/headers - see nextjsVersionBrowserDetect.ts. skipPlatformVersionDetect is set when the
// row's Platform/PlatformVersion were entered manually, so a PHP rescan doesn't pay for a
// browser launch whose result would just be discarded by scanAndStorePhpVersion's UPDATE.
async function scanWebsiteTech(url: string, skipPlatformVersionDetect: boolean): Promise<WebsiteTechScanResult> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(PHP_SCAN_TIMEOUT_MS),
      headers: { "User-Agent": PHP_SCAN_UA },
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

// Platform/PlatformVersion are only overwritten here when PlatformVersionManual = 0 - a PHP
// rescan (which always runs through this function) must never clobber a manually-recorded
// Next.js/WordPress/etc version the way scanAllPhpVersions already avoids clobbering a manual
// PhpVersion, since the two overrides are independent and this is the one place both land.
async function scanAndStorePhpVersion(db: Awaited<ReturnType<typeof getDb>>, id: number, url: string, platformVersionManual: boolean) {
  const { phpVersion, platform, platformVersion, serverHeader, scanError } = await scanWebsiteTech(url, platformVersionManual);
  await db
    .request()
    .input("id", sql.Int, id)
    .input("phpVersion", sql.NVarChar, phpVersion)
    .input("platform", sql.NVarChar, platform)
    .input("platformVersion", sql.NVarChar, platformVersion)
    .input("serverHeader", sql.NVarChar, serverHeader)
    .input("scanError", sql.NVarChar, scanError)
    .query(
      `UPDATE Websites SET PhpVersion = @phpVersion,
         Platform = CASE WHEN PlatformVersionManual = 1 THEN Platform ELSE @platform END,
         PlatformVersion = CASE WHEN PlatformVersionManual = 1 THEN PlatformVersion ELSE @platformVersion END,
         ServerHeader = @serverHeader, PhpVersionScanError = @scanError, PhpVersionCheckedAt = SYSUTCDATETIME(),
         PhpVersionManual = 0
       WHERE Id = @id`
    );
}

const PHP_VERSION_MANUAL_PATTERN = /^\d+(\.\d+){0,2}$/;
const PLATFORM_VERSION_MANUAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.\-]{0,29}$/;

const VALID_ENVIRONMENTS = new Set(["Live", "Staging", "Dev"]);

export async function addWebsite(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const environmentRaw = String(formData.get("environment") ?? "").trim();
  const environment = VALID_ENVIRONMENTS.has(environmentRaw) ? environmentRaw : "Live";

  let errorMessage: string | null = null;

  if (!name) {
    errorMessage = "Name is required.";
  } else if (!isValidUrl(url)) {
    errorMessage = "Enter a valid URL starting with http:// or https://";
  } else {
    const db = await getDb();
    await db
      .request()
      .input("name", sql.NVarChar, name)
      .input("url", sql.NVarChar, url)
      .input("environment", sql.NVarChar, environment)
      .query(`INSERT INTO Websites (Name, Url, Environment) VALUES (@name, @url, @environment)`);
  }

  revalidatePath("/dashboard/audit/websites");

  if (errorMessage) {
    redirect(`/dashboard/audit/websites?error=${encodeURIComponent(errorMessage)}`);
  }
  redirect("/dashboard/audit/websites");
}

export async function removeWebsite(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const db = await getDb();
  await db.request().input("id", sql.Int, id).query(`DELETE FROM Websites WHERE Id = @id`);

  revalidatePath("/dashboard/audit/websites");
  redirect("/dashboard/audit/websites");
}

export async function updateWebsite(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const environmentRaw = String(formData.get("environment") ?? "").trim();
  const environment = VALID_ENVIRONMENTS.has(environmentRaw) ? environmentRaw : "Live";

  if (!id) return;

  let errorMessage: string | null = null;
  if (!name) {
    errorMessage = "Name is required.";
  } else if (!isValidUrl(url)) {
    errorMessage = "Enter a valid URL starting with http:// or https://";
  } else {
    const db = await getDb();
    await db
      .request()
      .input("id", sql.Int, id)
      .input("name", sql.NVarChar, name)
      .input("url", sql.NVarChar, url)
      .input("environment", sql.NVarChar, environment)
      .query(`UPDATE Websites SET Name = @name, Url = @url, Environment = @environment WHERE Id = @id`);
  }

  revalidatePath("/dashboard/audit/websites");

  if (errorMessage) {
    redirect(`/dashboard/audit/websites?edit=${id}&error=${encodeURIComponent(errorMessage)}`);
  }
  redirect("/dashboard/audit/websites");
}

// Disabling (not deleting) is what every downstream tool — the other 4 audit tools and the
// Website Security Audit picker — filters on (`WHERE Enabled = 1`), so this is the single
// switch that "automatically reflects" everywhere per the feature's requirement.
export async function toggleWebsiteEnabled(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const db = await getDb();
  await db.request().input("id", sql.Int, id).query(`UPDATE Websites SET Enabled = CASE WHEN Enabled = 1 THEN 0 ELSE 1 END WHERE Id = @id`);

  revalidatePath("/dashboard/audit/websites");
  redirect("/dashboard/audit/websites");
}

// Reads the PHP version straight off the live X-Powered-By header (same signal as the
// php_version_disclosed check in the full Website Security Audit) and stores it on the row,
// so this list can show it as a plain column without needing a full audit scan.
export async function scanPhpVersion(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, id)
    .query<{ Url: string; PlatformVersionManual: boolean }>(`SELECT Url, PlatformVersionManual FROM Websites WHERE Id = @id`);
  const row = result.recordset[0];

  if (row) await scanAndStorePhpVersion(db, id, row.Url, row.PlatformVersionManual);

  revalidatePath("/dashboard/audit/websites");
  redirect("/dashboard/audit/websites");
}

// Scans every enabled website sequentially (not Promise.all) so this doesn't fire dozens of
// concurrent outbound requests at once from a single click - fine for the handful of sites
// this list holds today, and each scan already has its own 15s cap. Rows with a manually-set
// PHP version (PhpVersionManual = 1) are skipped so a bulk scan never silently overwrites an
// admin's deliberate override with a header-based "Not detected."
export async function scanAllPhpVersions() {
  const db = await getDb();
  const result = await db.query<{ Id: number; Url: string; PlatformVersionManual: boolean }>(
    `SELECT Id, Url, PlatformVersionManual FROM Websites WHERE Enabled = 1 AND PhpVersionManual = 0`
  );

  for (const site of result.recordset) {
    await scanAndStorePhpVersion(db, site.Id, site.Url, site.PlatformVersionManual);
  }

  revalidatePath("/dashboard/audit/websites");
  redirect("/dashboard/audit/websites");
}

// Same as scanAllPhpVersions but limited to whatever the user checked in the list (regardless
// of Enabled state - an explicit per-row selection is a more specific instruction than the
// Enabled flag that "Scan All" defers to). Also skips manually-set rows, same reasoning.
export async function scanSelectedPhpVersions(formData: FormData) {
  const ids = String(formData.get("ids") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return;

  const db = await getDb();
  const idList = ids.join(",");
  const result = await db.query<{ Id: number; Url: string; PlatformVersionManual: boolean }>(
    `SELECT Id, Url, PlatformVersionManual FROM Websites WHERE Id IN (${idList}) AND PhpVersionManual = 0`
  );

  for (const site of result.recordset) {
    await scanAndStorePhpVersion(db, site.Id, site.Url, site.PlatformVersionManual);
  }

  revalidatePath("/dashboard/audit/websites");
  redirect("/dashboard/audit/websites");
}

// Lets an admin record a PHP version they know from elsewhere (hosting panel, SSH, etc) when
// the live header doesn't disclose it. Marks the row so future bulk scans leave it alone -
// see the PhpVersionManual column comment in the v4 migration for the full reasoning.
export async function setPhpVersionManually(formData: FormData) {
  const id = Number(formData.get("id"));
  const version = String(formData.get("version") ?? "").trim();
  if (!id || !version) return;

  if (!PHP_VERSION_MANUAL_PATTERN.test(version)) {
    revalidatePath("/dashboard/audit/websites");
    redirect(`/dashboard/audit/websites?error=${encodeURIComponent("PHP version must look like 8.2 or 8.2.35")}`);
  }

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .input("version", sql.NVarChar, version)
    .query(
      `UPDATE Websites SET PhpVersion = @version, PhpVersionManual = 1, PhpVersionScanError = NULL, PhpVersionCheckedAt = SYSUTCDATETIME()
       WHERE Id = @id`
    );

  revalidatePath("/dashboard/audit/websites");
  redirect("/dashboard/audit/websites");
}

// Hands the row back to auto-detection - resets to "Not scanned" rather than guessing, since
// we don't know whether the manual value still matches what a real scan would find.
export async function clearPhpVersionManualOverride(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .query(
      `UPDATE Websites SET PhpVersion = NULL, PhpVersionManual = 0, PhpVersionScanError = NULL, PhpVersionCheckedAt = NULL
       WHERE Id = @id`
    );

  revalidatePath("/dashboard/audit/websites");
  redirect("/dashboard/audit/websites");
}

// Lets an admin record a platform + version pulled from somewhere other than the live scan -
// e.g. a Next.js app's package.json (Next.js never discloses its version on the page itself,
// unlike WordPress), or a WordPress site whose <meta name="generator"> tag has been stripped
// by a security plugin. Marks the row so scanAndStorePhpVersion's PHP rescans leave
// Platform/PlatformVersion alone - same reasoning as setPhpVersionManually/PhpVersionManual.
// Version is optional - an admin who only knows the platform (not the exact version, e.g. a
// hardened site with every passive disclosure signal stripped) can still record that much;
// an empty version was previously rejected by the same pattern a real version has to match,
// which silently failed the save with no clear reason shown.
export async function setPlatformVersionManually(formData: FormData) {
  const id = Number(formData.get("id"));
  const platform = String(formData.get("platform") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim();
  if (!id || !platform) return;

  if (platform.length > 40 || (version && !PLATFORM_VERSION_MANUAL_PATTERN.test(version))) {
    revalidatePath("/dashboard/audit/websites");
    redirect(`/dashboard/audit/websites?error=${encodeURIComponent("Choose a platform, and optionally enter a version like 14.2.3 or 6.4.2")}`);
  }

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .input("platform", sql.NVarChar, platform)
    .input("version", sql.NVarChar, version || null)
    .query(`UPDATE Websites SET Platform = @platform, PlatformVersion = @version, PlatformVersionManual = 1 WHERE Id = @id`);

  revalidatePath("/dashboard/audit/websites");
  redirect("/dashboard/audit/websites");
}

// Hands the Platform/PlatformVersion columns back to auto-detection - same reasoning as
// clearPhpVersionManualOverride, just for the platform/version pair instead of PhpVersion.
export async function clearPlatformVersionManualOverride(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .query(`UPDATE Websites SET Platform = NULL, PlatformVersion = NULL, PlatformVersionManual = 0 WHERE Id = @id`);

  revalidatePath("/dashboard/audit/websites");
  redirect("/dashboard/audit/websites");
}
