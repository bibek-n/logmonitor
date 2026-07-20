// "Knowledge Hub" section on the About Software page — tracks free learning/training
// material from two well-known, genuinely-free sources, split into the two topic groups
// the feature was asked for: IT Hardware & Networking, and Software & AI. Refreshed every 3
// days via Next.js fetch revalidation rather than a client-side timer — content at this
// cadence doesn't need to be "live" the way the news tickers do.
const REVALIDATE_SECONDS = 3 * 24 * 60 * 60; // 3 days

const HARDWARE_NETWORK_FEED = "https://www.professormesser.com/feed/"; // free CompTIA A+/Network+/Security+ training
const SOFTWARE_AI_FEED = "https://www.freecodecamp.org/news/rss/"; // free software/AI/dev tutorials

const SOFTWARE_AI_KEYWORDS = [
  "ai", "artificial intelligence", "machine learning", "llm", "gpt", "python", "javascript",
  "typescript", "software", "programming", "developer", "code", "coding", "api", "framework",
  "database", "cloud", "devops", "algorithm", "data science", "web dev", "react", "node",
];

export interface KnowledgeItem {
  title: string;
  link: string;
  pubDate: string | null;
}

export interface KnowledgeGroups {
  hardwareNetworking: KnowledgeItem[];
  softwareAi: KnowledgeItem[];
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
  // Trim before testing — some feeds (freeCodeCamp among them) pad whitespace/newlines
  // around the CDATA block itself, which would otherwise defeat the anchored regex below.
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

async function fetchFeed(url: string): Promise<{ title: string; link: string; pubDate: string | null; description: string }[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "LogMonitorKnowledgeHub/1.0" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssItems(xml).filter((item) => item.title && item.link);
  } catch {
    return [];
  }
}

function sortByRecency<T extends { pubDate: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db_ = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db_ - da;
  });
}

function toKnowledgeItem(item: { title: string; link: string; pubDate: string | null }): KnowledgeItem {
  return { title: item.title, link: item.link, pubDate: item.pubDate };
}

export async function getKnowledgeHub(limitPerGroup = 5): Promise<KnowledgeGroups> {
  const [hardwareItems, softwareItems] = await Promise.all([fetchFeed(HARDWARE_NETWORK_FEED), fetchFeed(SOFTWARE_AI_FEED)]);

  // Professor Messer's feed is already 100% IT hardware/networking certification training —
  // no topic filtering needed. freeCodeCamp covers a wider range (career advice, general web
  // dev, etc.), so it's filtered down to the software/AI-relevant items the feature asked for.
  const softwareFiltered = softwareItems.filter((item) => {
    const haystack = ` ${item.title} ${item.description} `.toLowerCase();
    return SOFTWARE_AI_KEYWORDS.some((kw) => haystack.includes(kw));
  });

  return {
    hardwareNetworking: sortByRecency(hardwareItems).slice(0, limitPerGroup).map(toKnowledgeItem),
    softwareAi: sortByRecency(softwareFiltered.length > 0 ? softwareFiltered : softwareItems)
      .slice(0, limitPerGroup)
      .map(toKnowledgeItem),
  };
}
