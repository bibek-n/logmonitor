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
    return { isWordPress: false, html, headers, finalUrl, coreVersion: null, themeSlug: null, themeVersion: null, plugins: [] };
  }

  const coreVersion = await detectCoreVersion(html, finalUrl);
  const themeSlug = /wp-content\/themes\/([a-z0-9_-]+)\//i.exec(html)?.[1] ?? null;
  const themeVersion = themeSlug ? await detectThemeVersion(finalUrl, themeSlug) : null;
  const plugins = detectPlugins(html);

  return { isWordPress: true, html, headers, finalUrl, coreVersion, themeSlug, themeVersion, plugins };
}

async function detectCoreVersion(html: string, baseUrl: string): Promise<string | null> {
  const generatorMatch = /<meta\s+name=["']generator["']\s+content=["']wordpress\s+([\d.]+)["']/i.exec(html);
  if (generatorMatch) return generatorMatch[1];

  // Fallback: many sites strip the generator meta tag, but readme.html is still served
  // by default and carries the same version string WordPress core ships with.
  try {
    const readme = await fetchPage(new URL("/readme.html", baseUrl).toString());
    const versionMatch = /version\s+([\d.]+)/i.exec(readme.html);
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
