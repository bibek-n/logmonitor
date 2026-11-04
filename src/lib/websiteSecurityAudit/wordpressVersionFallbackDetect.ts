// Extra passive WordPress version signals beyond the homepage's own <meta name="generator">
// tag (extractWordPressVersion in platformDetect.ts) - the same category of technique public
// WordPress security scanners (WPScan, HackerTarget's passive/survey scans) use for their
// free/low-impact checks, not the aggressive active-scan path-probing tier. Only called when
// the homepage tag came back empty, since most hardened sites strip that one tag specifically
// rather than every disclosure path at once - verified against real client sites before
// building this (see project memory).
//
// Kept out of platformDetect.ts (which only reads the single HTML fetch already in hand) since
// this makes its own extra network requests - mirrors why nextjsVersionBrowserDetect.ts is its
// own file too.
const WP_SCAN_TIMEOUT_MS = 10000;
const WP_SCAN_UA = "LogMonitor-WebsiteSecurityAudit/1.0 (+authorized-scan)";

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(WP_SCAN_TIMEOUT_MS),
      headers: { "User-Agent": WP_SCAN_UA },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// readme.html's "Version X.Y" line was dropped from the template in modern WordPress
// releases, but it's still the default shipped file and plenty of real installs (especially
// older ones) still print it near the top. Requires a genuine dotted X.Y(.Z) version right
// after "Version" - readme.html's GPL license boilerplate contains the unrelated phrase
// "version 2 of the License", which a looser single-number-permitting regex matches by
// mistake (caught live: every WordPress site in the fleet briefly showed "version 2").
async function extractFromReadme(origin: string): Promise<string | null> {
  const html = await fetchText(`${origin}/readme.html`);
  return html ? (/\bVersion\s+(\d+\.\d+(?:\.\d+)?)/i.exec(html)?.[1] ?? null) : null;
}

// The RSS feed carries its own <generator> tag with the same wordpress.org/?v=X.Y.Z string as
// the homepage meta tag - a second place to find the same disclosure, often left enabled even
// when the homepage tag is stripped by a security plugin/theme.
async function extractFromFeed(origin: string): Promise<string | null> {
  const xml = await fetchText(`${origin}/feed/`);
  return xml ? (/<generator>https?:\/\/wordpress\.org\/\?v=([\d.]+)<\/generator>/i.exec(xml)?.[1] ?? null) : null;
}

// wp-emoji-release.min.js and wp-embed.min.js are WordPress-authored core files that core
// itself enqueues with ?ver= set to the exact WordPress version - unlike a bundled library's
// own ?ver= (e.g. jquery.min.js?ver=3.7.1, which is jQuery's version, only an approximate
// correlate to a WP version range), these two are the standard "exact version via asset query
// string" fingerprint public scanners rely on, and they're read straight from the homepage
// HTML already fetched - no extra request needed.
function extractFromCoreAssetVersion(homepageHtml: string): string | null {
  return /(?:wp-emoji-release|wp-embed)(?:\.min)?\.js\?ver=([\d.]+)/i.exec(homepageHtml)?.[1] ?? null;
}

export async function detectWordPressVersionFallback(homepageHtml: string, url: string): Promise<string | null> {
  const fromAssets = extractFromCoreAssetVersion(homepageHtml);
  if (fromAssets) return fromAssets;

  const origin = new URL(url).origin;
  const fromFeed = await extractFromFeed(origin);
  if (fromFeed) return fromFeed;

  return extractFromReadme(origin);
}
