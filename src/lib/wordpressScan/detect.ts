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
  // True when the plain fetch() hit a challenge and this result (positive or negative) came
  // from the headless-browser retry instead — informational only (see runScan.ts's log line),
  // not persisted, since it doesn't change what the result means, only how it was obtained.
  viaHeadlessBrowser: boolean;
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

function checkIsWordPress(html: string, headers: Record<string, string>): boolean {
  return (
    /wp-content|wp-includes/i.test(html) ||
    /\/wp-json\//i.test(html) ||
    /generator["'][^>]*content=["']wordpress/i.test(html) ||
    headers["link"]?.includes("wp-json") === true
  );
}

const BROWSER_NAV_TIMEOUT_MS = 25000;
// Anti-bot interstitials (the ones matched by CHALLENGE_TEXT_SIGNATURES above) commonly clear
// themselves a few seconds after their own JS runs, via a `location.reload()`/redirect to the
// real page - this just needs to outlast that window before reading the page back.
const BROWSER_CHALLENGE_SETTLE_MS = 8000;

// Fallback for pages a plain fetch() can never get past: a real headless Chromium (Playwright,
// already a project dependency - see src/lib/websiteSecurityAudit/nextjsVersionBrowserDetect.ts
// for the same pattern) actually executes the challenge's JS and lands on the real page, the
// same way a normal visitor's browser does. Only worth the cost (browser launch + several
// seconds) when the plain fetch already looks blocked, so this is never called on a normal scan.
// Requires Chromium to be installed on the app server (`npx playwright install chromium`).
async function fetchPageViaBrowser(url: string): Promise<FetchedPage | null> {
  let browser: import("@playwright/test").Browser | undefined;
  try {
    const { chromium } = await import("@playwright/test");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 LogMonitor-WordPressScan/1.0 (+authorized-scan)",
    });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: BROWSER_NAV_TIMEOUT_MS });
    await page.waitForTimeout(BROWSER_CHALLENGE_SETTLE_MS);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    const html = await page.content();
    return { html, headers: response?.headers() ?? {}, finalUrl: page.url(), status: response?.status() ?? 0 };
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}

// Passive-only detection: everything here comes from a single normal page load (plus, for
// version details that aren't in the HTML, one or two follow-up GETs of files WordPress
// itself serves publicly — readme.html, a theme's style.css — and, only when that first load
// looks like an anti-bot challenge, one headless-browser retry). No brute forcing, no
// authentication attempts, nothing beyond what a browser visiting the site would trigger.
export async function detectWordPress(url: string): Promise<WpDetection> {
  const fetched = await fetchPage(url);
  let { html, headers, finalUrl } = fetched;
  let isWordPress = checkIsWordPress(html, headers);
  let viaHeadlessBrowser = false;

  if (!isWordPress) {
    const blockReason = looksLikeAntiBotChallenge(html);
    if (!blockReason) {
      return {
        isWordPress: false,
        html,
        headers,
        finalUrl,
        coreVersion: null,
        themeSlug: null,
        themeVersion: null,
        plugins: [],
        blockReason: null,
        viaHeadlessBrowser,
      };
    }

    const viaBrowser = await fetchPageViaBrowser(url);
    if (!viaBrowser) {
      return {
        isWordPress: false,
        html,
        headers,
        finalUrl,
        coreVersion: null,
        themeSlug: null,
        themeVersion: null,
        plugins: [],
        blockReason: `${blockReason} A headless-browser retry also failed to load the page (Chromium may not be installed on the server, or the page timed out).`,
        viaHeadlessBrowser,
      };
    }

    const browserIsWordPress = checkIsWordPress(viaBrowser.html, viaBrowser.headers);
    const stillBlocked = !browserIsWordPress ? looksLikeAntiBotChallenge(viaBrowser.html) : null;
    if (!browserIsWordPress && stillBlocked) {
      return {
        isWordPress: false,
        html,
        headers,
        finalUrl,
        coreVersion: null,
        themeSlug: null,
        themeVersion: null,
        plugins: [],
        blockReason: `${blockReason} A headless-browser retry also could not get past it (likely a CAPTCHA/human-verification step beyond plain JS execution, not just a timed reload).`,
        viaHeadlessBrowser: true,
      };
    }

    // Browser cleared the challenge (or at least reached real content) - trust this result,
    // positive or negative, over the blocked plain-fetch one, and continue below with it.
    html = viaBrowser.html;
    headers = viaBrowser.headers;
    finalUrl = viaBrowser.finalUrl;
    isWordPress = browserIsWordPress;
    viaHeadlessBrowser = true;

    if (!isWordPress) {
      return {
        isWordPress: false,
        html,
        headers,
        finalUrl,
        coreVersion: null,
        themeSlug: null,
        themeVersion: null,
        plugins: [],
        blockReason: null,
        viaHeadlessBrowser,
      };
    }
  }

  const coreVersion = await detectCoreVersion(html, finalUrl);
  const themeSlug = /wp-content\/themes\/([a-z0-9_-]+)\//i.exec(html)?.[1] ?? null;
  const themeVersion = themeSlug ? await detectThemeVersion(finalUrl, themeSlug) : null;
  const plugins = detectPlugins(html);

  return { isWordPress: true, html, headers, finalUrl, coreVersion, themeSlug, themeVersion, plugins, blockReason: null, viaHeadlessBrowser };
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
