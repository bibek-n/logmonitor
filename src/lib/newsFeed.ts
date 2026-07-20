// "Hot news" ticker on the public marketing site — pulls from TechSansar (a Nepali IT news
// site) and keeps only items that actually look like networking/hardware/IT-infrastructure
// news, since the raw feed also carries general AI/startup/policy stories that aren't a fit
// for a network-monitoring product's homepage.
const FEED_URL = "https://techsansar.com/feed/";

const RELEVANT_KEYWORDS = [
  "network", "networking", "router", "switch", "server", "hardware", "data center", "datacenter",
  "cloud", "cybersecurity", "cyber security", "security", "firewall", "vpn", "telecom",
  "isp", "broadband", "wifi", "wi-fi", "5g", "fiber", "computer", "laptop", "processor",
  "chip", "semiconductor", "cpu", "gpu", "infrastructure", "it ", "bandwidth", "internet",
];

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string | null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#8217;|&#039;|&rsquo;/g, "'")
    .replace(/&#8216;|&lsquo;/g, "'")
    .replace(/&#8220;|&ldquo;/g, '"')
    .replace(/&#8221;|&rdquo;/g, '"')
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripCdata(raw: string): string {
  // Trim before testing — some feeds pad whitespace/newlines around the CDATA block
  // itself, which would otherwise defeat the anchored regex below.
  const trimmed = raw.trim();
  const match = trimmed.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return decodeHtmlEntities((match ? match[1] : trimmed).trim());
}

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripCdata(match[1]) : null;
}

function extractAllTags(block: string, tag: string): string[] {
  const matches = block.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"));
  return [...matches].map((m) => stripCdata(m[1]));
}

// Minimal hand-rolled RSS 2.0 parser — no XML dependency in this repo, and a full XML
// parser would be overkill for reading title/link/pubDate/category out of a well-formed
// WordPress feed.
function parseRssItems(xml: string): { title: string; link: string; pubDate: string | null; description: string; categories: string[] }[] {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return itemBlocks.map((block) => ({
    title: extractTag(block, "title") ?? "",
    link: extractTag(block, "link") ?? "",
    pubDate: extractTag(block, "pubDate"),
    description: extractTag(block, "description") ?? "",
    categories: extractAllTags(block, "category"),
  }));
}

function isRelevant(item: { title: string; description: string; categories: string[] }): boolean {
  const haystack = `${item.title} ${item.description} ${item.categories.join(" ")}`.toLowerCase();
  return RELEVANT_KEYWORDS.some((kw) => haystack.includes(kw));
}

// Cached for 15 minutes via Next.js's fetch revalidation — matches the ticker's own
// client-side refresh interval, so a poll never re-fetches TechSansar more often than the
// ticker actually needs a fresh answer.
const FRESHNESS_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — a "hot news" ticker shouldn't surface year-old stories
const MIN_ITEMS = 3; // fall back to older items only if the fresh set is too thin to fill the ticker

export async function getNetworkHardwareNews(limit = 8): Promise<NewsItem[]> {
  const res = await fetch(FEED_URL, {
    headers: { "User-Agent": "LogMonitorNewsTicker/1.0" },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Feed fetch failed (HTTP ${res.status}).`);
  const xml = await res.text();

  const relevant = parseRssItems(xml)
    .filter((item) => item.title && item.link)
    .filter(isRelevant)
    .sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db_ = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db_ - da;
    });

  const now = Date.now();
  const fresh = relevant.filter((item) => item.pubDate && now - new Date(item.pubDate).getTime() <= FRESHNESS_CUTOFF_MS);
  const chosen = fresh.length >= MIN_ITEMS ? fresh : relevant;

  return chosen.slice(0, limit).map((item) => ({ title: item.title, link: item.link, pubDate: item.pubDate }));
}
