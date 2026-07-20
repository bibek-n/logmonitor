import type { ScanFinding } from "./shared";
import { fetchPage } from "./fetchPage";

const FETCH_TIMEOUT_MS = 10000;
// Broken-link and redirect probes run several requests concurrently, but capped - not
// unbounded parallel fan-out against someone else's server (same cap WordPress Scan uses
// for its own passive-recon probes).
const PROBE_CONCURRENCY = 6;
// A page can link to hundreds of URLs - capped so one scan can't turn into an unbounded
// crawl of a third-party site.
const MAX_LINKS_CHECKED = 25;

async function probe(url: string): Promise<{ status: number }> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    // Some servers don't implement HEAD at all (405/501) - fall back to a real GET rather
    // than reporting a false "broken link".
    if (res.status === 405 || res.status === 501) {
      const getRes = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      return { status: getRes.status };
    }
    return { status: res.status };
  } catch {
    return { status: 0 };
  }
}

export async function checkRobotsTxt(baseUrl: string): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  try {
    const page = await fetchPage(new URL("/robots.txt", baseUrl).toString());
    if (page.status !== 200) {
      findings.push({
        check: "robots_txt",
        severity: "medium",
        title: "robots.txt not found",
        detail: `Request returned HTTP ${page.status}. Without robots.txt, search engines fall back to default crawl behavior.`,
      });
      return findings;
    }
    // Crude but effective: a "Disallow: /" line anywhere reasonably close after a
    // "User-agent: *" block blocks the entire site from that crawler.
    if (/user-agent:\s*\*[\s\S]{0,200}?disallow:\s*\/\s*(\r?\n|$)/im.test(page.html)) {
      findings.push({
        check: "robots_txt",
        severity: "critical",
        title: "robots.txt blocks all crawlers",
        detail: 'A "Disallow: /" under "User-agent: *" prevents search engines from indexing the entire site.',
        evidence: page.html.slice(0, 300),
      });
    }
  } catch (err) {
    findings.push({
      check: "robots_txt",
      severity: "medium",
      title: "robots.txt could not be fetched",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }
  return findings;
}

export async function checkSitemapXml(baseUrl: string): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  try {
    const page = await fetchPage(new URL("/sitemap.xml", baseUrl).toString());
    if (page.status !== 200) {
      findings.push({
        check: "sitemap_xml",
        severity: "medium",
        title: "sitemap.xml not found",
        detail: `Request returned HTTP ${page.status}. A sitemap helps search engines discover pages efficiently.`,
      });
      return findings;
    }
    const looksLikeXml = /<\?xml/i.test(page.html) || /<urlset/i.test(page.html) || /<sitemapindex/i.test(page.html);
    if (!looksLikeXml) {
      findings.push({
        check: "sitemap_xml",
        severity: "medium",
        title: "sitemap.xml does not look like valid XML",
        detail: "The file was found but doesn't contain the expected <urlset> or <sitemapindex> root element.",
      });
    }
  } catch (err) {
    findings.push({
      check: "sitemap_xml",
      severity: "medium",
      title: "sitemap.xml could not be fetched",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }
  return findings;
}

export function checkMetaTags(html: string): ScanFinding[] {
  const findings: ScanFinding[] = [];

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch?.[1]?.trim() ?? "";
  if (!title) {
    findings.push({ check: "meta_tags", severity: "high", title: "Missing <title> tag", detail: "Every page should have a unique, descriptive title." });
  } else if (title.length > 60) {
    findings.push({
      check: "meta_tags",
      severity: "low",
      title: "Title tag is long",
      detail: `Title is ${title.length} characters; search engines typically truncate titles beyond ~60.`,
      evidence: title,
    });
  }

  const descMatch =
    /<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html) ??
    /<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(html);
  const description = descMatch?.[1]?.trim() ?? "";
  if (!description) {
    findings.push({
      check: "meta_tags",
      severity: "high",
      title: "Missing meta description",
      detail: "A meta description influences the snippet shown in search results.",
    });
  } else if (description.length > 160) {
    findings.push({
      check: "meta_tags",
      severity: "low",
      title: "Meta description is long",
      detail: `Description is ${description.length} characters; search engines typically truncate beyond ~160.`,
      evidence: description,
    });
  }

  return findings;
}

export function checkCanonicalUrl(html: string, finalUrl: string): ScanFinding[] {
  const canonicalMatch =
    /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html) ??
    /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i.exec(html);
  if (!canonicalMatch) {
    return [{ check: "canonical_url", severity: "medium", title: "Missing canonical URL", detail: 'A <link rel="canonical"> tag helps prevent duplicate-content issues.' }];
  }
  const canonicalUrl = canonicalMatch[1];
  try {
    const canonicalHost = new URL(canonicalUrl, finalUrl).hostname;
    const pageHost = new URL(finalUrl).hostname;
    if (canonicalHost !== pageHost) {
      return [
        {
          check: "canonical_url",
          severity: "medium",
          title: "Canonical URL points to a different domain",
          detail: `Canonical is "${canonicalUrl}" but the page was served from "${pageHost}".`,
          evidence: canonicalUrl,
        },
      ];
    }
  } catch {
    return [{ check: "canonical_url", severity: "low", title: "Canonical URL is not a valid URL", evidence: canonicalUrl }];
  }
  return [];
}

function extractLinks(html: string, baseUrl: string): string[] {
  const hrefs = [...html.matchAll(/<a\s+[^>]*href=["']([^"'#][^"']*)["']/gi)].map((m) => m[1]);
  const resolved = new Set<string>();
  for (const href of hrefs) {
    try {
      const url = new URL(href, baseUrl);
      if (url.protocol === "http:" || url.protocol === "https:") resolved.add(url.toString());
    } catch {
      // malformed/unsupported href scheme (mailto:, tel:, javascript:) - not a link to probe
    }
  }
  return [...resolved];
}

export async function checkBrokenLinks(html: string, baseUrl: string): Promise<ScanFinding[]> {
  const links = extractLinks(html, baseUrl).slice(0, MAX_LINKS_CHECKED);
  const findings: ScanFinding[] = [];
  for (let i = 0; i < links.length; i += PROBE_CONCURRENCY) {
    const batch = links.slice(i, i + PROBE_CONCURRENCY);
    const results = await Promise.all(batch.map(async (link) => ({ link, status: (await probe(link)).status })));
    for (const r of results) {
      if (r.status === 0 || r.status >= 400) {
        findings.push({
          check: "broken_links",
          severity: r.status === 0 ? "medium" : "high",
          title: `Broken link: ${r.link}`,
          detail: r.status === 0 ? "Request failed or timed out." : `Returned HTTP ${r.status}.`,
        });
      }
    }
  }
  return findings;
}

export function checkImageAlt(html: string): ScanFinding[] {
  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const missing = imgTags.filter((tag) => {
    const altMatch = /alt=["']([^"']*)["']/i.exec(tag);
    return !altMatch || altMatch[1].trim() === "";
  });
  if (missing.length === 0) return [];
  return [
    {
      check: "image_alt",
      severity: "medium",
      title: `${missing.length} image(s) missing alt text`,
      detail: "Images without descriptive alt attributes hurt accessibility and image-search visibility.",
      evidence: missing.slice(0, 5).join("\n"),
    },
  ];
}

export function checkOpenGraph(html: string): ScanFinding[] {
  const required = ["og:title", "og:description", "og:image", "og:url"];
  const missing = required.filter((prop) => !new RegExp(`<meta\\s+[^>]*property=["']${prop}["']`, "i").test(html));
  if (missing.length === 0) return [];
  return [
    {
      check: "open_graph",
      severity: "low",
      title: `Missing Open Graph tag(s): ${missing.join(", ")}`,
      detail: "Open Graph tags control how the page appears when shared on Facebook, LinkedIn, and other platforms.",
    },
  ];
}

export function checkTwitterCards(html: string): ScanFinding[] {
  const required = ["twitter:card", "twitter:title", "twitter:description", "twitter:image"];
  const missing = required.filter((name) => !new RegExp(`<meta\\s+[^>]*name=["']${name}["']`, "i").test(html));
  if (missing.length === 0) return [];
  return [
    {
      check: "twitter_cards",
      severity: "low",
      title: `Missing Twitter Card tag(s): ${missing.join(", ")}`,
      detail: "Twitter Card tags control how the page appears when shared on X/Twitter.",
    },
  ];
}

export function checkStructuredData(html: string): ScanFinding[] {
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  if (scripts.length === 0) {
    return [
      {
        check: "structured_data",
        severity: "low",
        title: "No structured data (JSON-LD) found",
        detail: "Structured data helps search engines understand page content and can enable rich results in search listings.",
      },
    ];
  }
  const findings: ScanFinding[] = [];
  for (const script of scripts) {
    try {
      JSON.parse(script);
    } catch {
      findings.push({
        check: "structured_data",
        severity: "medium",
        title: "Invalid JSON-LD structured data",
        detail: 'A <script type="application/ld+json"> block does not contain valid JSON.',
        evidence: script.slice(0, 200),
      });
    }
  }
  return findings;
}
