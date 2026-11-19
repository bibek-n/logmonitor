import type { DetectedPlugin } from "./shared";

const FETCH_TIMEOUT_MS = 15000;

export interface FetchedPage {
  html: string;
  headers: Record<string, string>;
  finalUrl: string;
  status: number;
}

export async function fetchPage(url: string): Promise<FetchedPage> {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const html = await res.text();
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  return { html, headers, finalUrl: res.url, status: res.status };
}

export interface WpDetection {
  isWordPress: boolean;
  html: string;
  headers: Record<string, string>;
  finalUrl: string;
  coreVersion: string | null;
  themeSlug: string | null;
  themeVersion: string | null;
  plugins: DetectedPlugin[];
  // Set when the page we fetched looks like an anti-bot/JS-challenge interstitial rather than
  // the site's real content (see looksLikeAntiBotChallenge below). When this is set,
  // `isWordPress: false` does NOT mean "confirmed not WordPress" - it means the scan never
  // actually saw the real page, so the result is unknown rather than negative. Null otherwise.
  blockReason: string | null;
}

// Known anti-bot/JS-challenge interstitials that a plain fetch() (no JS execution) can never
// get past - these replace the real page for every non-browser client, not just this scanner,
// so a passive detector sees only the challenge markup and nothing of the actual site. Matching
// on the page's own title/body text rather than the hosting provider, since the same challenge
// template is reused across many different WAFs/security products.
const CHALLENGE_TEXT_SIGNATURES = [
  /one moment,? please/i,
  /just a moment/i,
  /checking your browser before accessing/i,
  /attention required!? \| cloudflare/i,
  /ddos protection by/i,
  /verify you are( a)? human/i,
  /enable javascript and cookies to continue/i,
  /please wait while we (check|verify)/i,
  /browser verification/i,
];

// Structural fallback for challenge pages that don't match a known phrase: a short page
// (real WordPress homepages are essentially never this small) whose only script content is an
// immediate client-side redirect/reload with no actual page content to speak of.
function looksLikeAntiBotChallenge(html: string): string | null {
  for (const sig of CHALLENGE_TEXT_SIGNATURES) {
    if (sig.test(html)) {
      const titleMatch = /<title>([^<]*)<\/title>/i.exec(html);
      return `Site returned an anti-bot/JS challenge page${titleMatch ? ` ("${titleMatch[1].trim()}")` : ""} instead of real content - a plain scan request cannot pass this, so WordPress could not be confirmed either way.`;
    }
  }
  const hasAutoRedirect = /<script[^>]*>[\s\S]{0,400}?(location\.reload|location\.href\s*=|location\.replace)/i.test(html);
  if (hasAutoRedirect && html.length < 4000 && !/wp-content|wp-includes|<article|<main\b/i.test(html)) {
    return `Page is very small and immediately redirects/reloads via JavaScript with no real content - looks like an anti-bot challenge page rather than the site itself, so WordPress could not be confirmed either way.`;
  }
  return null;
}

// Passive-only detection: everything here comes from a single normal page load (plus, for
// version details that aren't in the HTML, one or two follow-up GETs of files WordPress
// itself serves publicly — readme.html, a theme's style.css). No brute forcing, no
// authentication attempts, nothing beyond what a browser visiting the site would trigger.
export async function detectWordPress(url: string): Promise<WpDetection> {
  const page = await fetchPage(url);
  const { html, headers, finalUrl } = page;

  const isWordPress =
    /wp-content|wp-includes/i.test(html) ||
    /\/wp-json\//i.test(html) ||
    /generator["'][^>]*content=["']wordpress/i.test(html) ||
    headers["link"]?.includes("wp-json") === true;

  if (!isWordPress) {
    const blockReason = looksLikeAntiBotChallenge(html);
    return { isWordPress: false, html, headers, finalUrl, coreVersion: null, themeSlug: null, themeVersion: null, plugins: [], blockReason };
  }

  const coreVersion = await detectCoreVersion(html, finalUrl);
  const themeSlug = /wp-content\/themes\/([a-z0-9_-]+)\//i.exec(html)?.[1] ?? null;
  const themeVersion = themeSlug ? await detectThemeVersion(finalUrl, themeSlug) : null;
  const plugins = detectPlugins(html);

  return { isWordPress: true, html, headers, finalUrl, coreVersion, themeSlug, themeVersion, plugins, blockReason: null };
}

async function detectCoreVersion(html: string, baseUrl: string): Promise<string | null> {
  const generatorMatch = /<meta\s+name=["']generator["']\s+content=["']wordpress\s+([\d.]+)["']/i.exec(html);
  if (generatorMatch) return generatorMatch[1];

  // Fallback: many sites strip the generator meta tag, but readme.html is still served
  // by default and carries the same version string WordPress core ships with. Requires a
  // genuine dotted X.Y(.Z) version right after "Version" - readme.html's GPL license
  // boilerplate contains the unrelated phrase "version 2 of the License", which a looser
  // single-number-permitting regex matches by mistake (caught live via a real scan: a site
  // briefly showed core version "2"). Same fix already applied to
  // src/lib/websiteSecurityAudit/wordpressVersionFallbackDetect.ts for the same reason.
  try {
    const readme = await fetchPage(new URL("/readme.html", baseUrl).toString());
    const versionMatch = /version\s+(\d+\.\d+(?:\.\d+)?)/i.exec(readme.html);
    if (readme.status === 200 && versionMatch) return versionMatch[1];
  } catch {
    // readme.html not reachable — leave core version unknown rather than guessing.
  }
  return null;
}

async function detectThemeVersion(baseUrl: string, themeSlug: string): Promise<string | null> {
  try {
    const styleCss = await fetchPage(new URL(`/wp-content/themes/${themeSlug}/style.css`, baseUrl).toString());
    if (styleCss.status !== 200) return null;
    const versionMatch = /^\s*Version:\s*([\d.]+)/im.exec(styleCss.html);
    return versionMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

// Plugins are only detectable passively when the page actually enqueues one of their
// assets (a script/style under wp-content/plugins/<slug>/) — plugins that only run
// server-side (e.g. security/caching plugins) leave no trace in the HTML and won't appear
// here. This mirrors what any passive external scanner can see without authenticated
// wp-admin access.
function detectPlugins(html: string): DetectedPlugin[] {
  const matches = [...html.matchAll(/wp-content\/plugins\/([a-z0-9_-]+)\/[^"'\s]*?(?:[?&]ver=([\d.]+))?["'\s>]/gi)];
  const bySlug = new Map<string, string | null>();
  for (const m of matches) {
    const slug = m[1];
    const version = m[2] ?? null;
    if (!bySlug.has(slug) || (version && !bySlug.get(slug))) bySlug.set(slug, version);
  }
  return [...bySlug.entries()].map(([slug, version]) => ({ slug, version }));
}
