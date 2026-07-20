// "Hot news" widget for the public marketing home page — aggregates a few well-known,
// confirmed-working developer/AI feeds and keeps only items that look like programming
// platform or AI news, since Hacker News and dev.to both carry a lot of unrelated content
// (general science, career posts, etc.) alongside the on-topic stories.
const FEED_URLS = ["https://hnrss.org/frontpage", "https://github.blog/feed/", "https://dev.to/feed"];

const RELEVANT_KEYWORDS = [
  "ai", "artificial intelligence", "machine learning", "llm", "gpt", "chatgpt", "openai",
  "anthropic", "claude", "gemini", "copilot", "neural", "model", "agent",
  "github", "gitlab", "programming", "framework", "language", "python", "javascript",
  "typescript", "react", "node", "docker", "kubernetes", "api", "sdk", "open source",
  "opensource", "developer", "ide", "compiler", "npm", "database", "cloud", "devops",
  "rust", "golang", " go ", "java", "vscode", "code editor", "software",
];

export interface DevNewsItem {
  title: string;
  link: string;
  pubDate: string | null;
  source: string;
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

function parseRssItems(xml: string): { title: string; link: string; pubDate: string | null; description: string }[] {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return itemBlocks.map((block) => ({
    title: extractTag(block, "title") ?? "",
    link: extractTag(block, "link") ?? "",
    pubDate: extractTag(block, "pubDate"),
    description: extractTag(block, "description") ?? "",
  }));
}

function isRelevant(item: { title: string; description: string }): boolean {
  const haystack = ` ${item.title} ${item.description} `.toLowerCase();
  return RELEVANT_KEYWORDS.some((kw) => haystack.includes(kw));
}

function sourceLabelFor(feedUrl: string): string {
  if (feedUrl.includes("hnrss")) return "Hacker News";
  if (feedUrl.includes("github.blog")) return "GitHub Blog";
  if (feedUrl.includes("dev.to")) return "DEV Community";
  return "News";
}

async function fetchFeed(url: string): Promise<{ title: string; link: string; pubDate: string | null; description: string }[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "LogMonitorNewsTicker/1.0" },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssItems(xml).filter((item) => item.title && item.link);
  } catch {
    // One dead feed shouldn't blank the whole widget — the others still contribute items.
    return [];
  }
}

const FRESHNESS_CUTOFF_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const MIN_ITEMS = 3;
const MAX_PER_SOURCE = 4; // dev.to posts far more often than the others — cap it so the widget shows a mix, not just one feed

function capPerSource<T extends { source: string }>(items: T[], maxPerSource: number): T[] {
  const counts = new Map<string, number>();
  return items.filter((item) => {
    const count = counts.get(item.source) ?? 0;
    if (count >= maxPerSource) return false;
    counts.set(item.source, count + 1);
    return true;
  });
}

export async function getDevAiNews(limit = 10): Promise<DevNewsItem[]> {
  const perFeed = await Promise.all(FEED_URLS.map((url) => fetchFeed(url).then((items) => ({ url, items }))));

  const relevant = perFeed
    .flatMap(({ url, items }) => items.filter(isRelevant).map((item) => ({ ...item, source: sourceLabelFor(url) })))
    .sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db_ = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db_ - da;
    });

  const now = Date.now();
  const fresh = relevant.filter((item) => item.pubDate && now - new Date(item.pubDate).getTime() <= FRESHNESS_CUTOFF_MS);
  const chosen = capPerSource(fresh.length >= MIN_ITEMS ? fresh : relevant, MAX_PER_SOURCE);

  return chosen.slice(0, limit).map((item) => ({ title: item.title, link: item.link, pubDate: item.pubDate, source: item.source }));
}
