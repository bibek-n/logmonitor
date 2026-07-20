import type { Finding } from "./types";

const UA = "LogMonitor-WebsiteSecurityAudit/1.0 (+authorized-scan)";
const FETCH_TIMEOUT_MS = 15000;

// Hardcoded "current supported line" cutoff — same best-effort pattern as
// KNOWN_EOL_PACKAGES in dependencyChecks.ts. No live WordPress CVE feed is used (WPScan's
// API requires a registered key, out of scope for this scanner) — version/exposure/EOL
// checks only.
const WORDPRESS_MIN_SUPPORTED_MINOR = 6.4;

async function safeFetch(url: string, init?: RequestInit) {
  return fetch(url, { redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { "User-Agent": UA }, ...init });
}

function extractWpVersion(html: string): string | null {
  const generatorMatch = /<meta name="generator" content="WordPress (\d+\.\d+(?:\.\d+)?)"/i.exec(html);
  if (generatorMatch) return generatorMatch[1];

  // Most reliable passive signal when the generator tag is stripped: WordPress core assets
  // are cache-busted with ?ver=$wp_version (e.g. /wp-includes/js/wp-emoji-release.min.js?
  // ver=6.4.3) — this directly reflects the running core version, unlike readme.html's
  // free-form text which can contain unrelated "version N" strings (changelog entries,
  // bundled plugin/theme text) that look superficially similar.
  const coreAssetMatch = /\/wp-(?:includes|admin)\/[^"'?]+\?ver=(\d+\.\d+(?:\.\d+)?)/i.exec(html);
  return coreAssetMatch?.[1] ?? null;
}

// Passive plugin discovery — the same technique WPScan and similar tools use: WordPress
// enqueues each active plugin's own assets from /wp-content/plugins/{slug}/..., which is
// visible in the page's own HTML without any login. Capped to bound total requests.
const MAX_PLUGINS_TO_CHECK = 20;

function extractPluginSlugs(html: string): string[] {
  const slugs = new Set<string>();
  for (const m of html.matchAll(/\/wp-content\/plugins\/([a-z0-9][a-z0-9_-]*)\//gi)) {
    slugs.add(m[1].toLowerCase());
  }
  return [...slugs].slice(0, MAX_PLUGINS_TO_CHECK);
}

function extractActiveTheme(html: string): string | null {
  return /\/wp-content\/themes\/([a-z0-9][a-z0-9_-]*)\//i.exec(html)?.[1] ?? null;
}

async function fetchStableTag(url: string): Promise<string | null> {
  try {
    const res = await safeFetch(url);
    if (res.status !== 200) return null;
    const text = await res.text();
    return /Stable tag:\s*([\w.]+)/i.exec(text)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function fetchThemeVersion(url: string): Promise<string | null> {
  try {
    const res = await safeFetch(url);
    if (res.status !== 200) return null;
    const text = await res.text();
    return /^\s*Version:\s*([\w.]+)/im.exec(text)?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function runWordPressChecks(baseUrl: string, homepageHtml: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const u = new URL(baseUrl);

  let version = extractWpVersion(homepageHtml);
  if (!version) {
    try {
      const readmeRes = await safeFetch(`${u.origin}/readme.html`);
      if (readmeRes.status === 200) {
        const readmeHtml = await readmeRes.text();
        // Requires a genuine dotted version (X.Y or X.Y.Z) right after "Version" — rejects
        // bare single-number matches that turned out to come from unrelated changelog text
        // rather than WordPress's own declared core version.
        version = /Version\s+(\d+\.\d+(?:\.\d+)?)/i.exec(readmeHtml)?.[1] ?? null;
      }
    } catch {
      // readme.html unreachable — not itself a finding
    }
  }

  if (version) {
    findings.push({
      category: "cms_version_disclosed",
      severity: "low",
      title: `WordPress version disclosed: ${version}`,
      recommendation: "Remove the generator meta tag and readme.html, and keep WordPress core up to date.",
    });
    const minor = parseFloat(version.split(".").slice(0, 2).join("."));
    if (!Number.isNaN(minor) && minor < WORDPRESS_MIN_SUPPORTED_MINOR) {
      findings.push({
        category: "cms_eol_version",
        severity: "high",
        title: `WordPress version ${version} appears older than the current supported release line`,
        description: "This is a best-effort comparison against a hardcoded cutoff, not a live CVE database lookup.",
        recommendation: "Upgrade WordPress core to the latest supported version to receive security patches.",
      });
    }
  }

  try {
    const xmlrpcRes = await safeFetch(`${u.origin}/xmlrpc.php`, { method: "POST" });
    if (xmlrpcRes.status !== 404) {
      findings.push({
        category: "cms_xmlrpc_exposed",
        severity: "medium",
        title: "xmlrpc.php is reachable",
        recommendation: "Disable xmlrpc.php if XML-RPC/pingback functionality isn't needed, or restrict it to known IPs.",
      });
    }
  } catch {
    // unreachable — not itself a finding
  }

  try {
    const wpJsonRes = await safeFetch(`${u.origin}/wp-json/`);
    if (wpJsonRes.status === 200) {
      findings.push({
        category: "exposed_admin_api",
        severity: "info",
        title: "wp-json REST API is reachable",
        description: "This may be expected — WordPress's REST API is often intentionally public for some endpoints.",
      });
    }
  } catch {
    // unreachable — not itself a finding
  }

  try {
    const authorRes = await safeFetch(`${u.origin}/?author=1`);
    const location = authorRes.headers.get("location");
    const usernameMatch = location ? /\/author\/([^/]+)\/?$/.exec(location) : null;
    if (authorRes.status >= 300 && authorRes.status < 400 && usernameMatch) {
      findings.push({
        category: "cms_user_enum",
        severity: "medium",
        title: `Username enumerable via ?author=1 (found: ${usernameMatch[1]})`,
        recommendation: "Disable author-archive redirects or use a plugin to block username enumeration via ?author=N.",
      });
    }
  } catch {
    // unreachable — not itself a finding
  }

  // Plugin enumeration — passive only, via assets the site itself already serves publicly.
  const pluginSlugs = extractPluginSlugs(homepageHtml);
  const plugins = await Promise.all(
    pluginSlugs.map(async (slug) => ({
      slug,
      version: await fetchStableTag(`${u.origin}/wp-content/plugins/${slug}/readme.txt`),
    }))
  );
  if (plugins.length > 0) {
    findings.push({
      category: "cms_plugins_detected",
      severity: "info",
      title: `${plugins.length} active plugin(s) detected`,
      description: plugins.map((p) => `${p.slug}${p.version ? ` (v${p.version})` : " (version not disclosed)"}`).join(", "),
      recommendation: "Cross-check each plugin name/version against the WordPress plugin repository or a vulnerability database (e.g. wpscan.com/plugins) for known CVEs, and keep all plugins updated.",
    });
    for (const p of plugins) {
      if (p.version) {
        findings.push({
          category: "cms_plugin_version_disclosed",
          severity: "low",
          title: `Plugin "${p.slug}" version disclosed: ${p.version}`,
          recommendation: `Verify "${p.slug}" ${p.version} against known CVEs for this plugin and keep it updated.`,
        });
      }
    }
  }

  // Active theme — same passive technique, one extra request for its declared version.
  const themeSlug = extractActiveTheme(homepageHtml);
  if (themeSlug) {
    const themeVersion = await fetchThemeVersion(`${u.origin}/wp-content/themes/${themeSlug}/style.css`);
    findings.push({
      category: "cms_theme_detected",
      severity: "info",
      title: `Active theme detected: ${themeSlug}${themeVersion ? ` (v${themeVersion})` : ""}`,
      recommendation: themeVersion ? `Verify theme "${themeSlug}" ${themeVersion} against known CVEs and keep it updated.` : undefined,
    });
  }

  return findings;
}
