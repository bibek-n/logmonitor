// "Nepali Tech News" widget — techpana.com's feed is a general Nepali news feed under a
// tech-branded name (crime, celebrity, and general-interest stories mixed in alongside real
// tech coverage), so this filters down to genuinely tech-relevant items using both English
// and Nepali keywords, matching the filtering approach already used for the other Nepali
// news ticker (newsFeed.ts) and the dev/AI widget (devAiNewsFeed.ts).
const FEED_URL = "https://techpana.com/feed/";

const RELEVANT_KEYWORDS = [
  "technology", "tech", "software", "hardware", "internet", "app ", "mobile", "computer",
  "digital", " ai ", "artificial intelligence", "laptop", "smartphone", "iphone", "android",
  "website", "telecom", "network", "wifi", "chip", "robot", "cyber", "data center", "startup",
  "प्रविधि", "सफ्टवेयर", "हार्डवेयर", "इन्टरनेट", "एप्लिकेसन", "मोबाइल", "कम्प्युटर", "डिजिटल",
  "एआई", "ल्यापटप", "वेबसाइट", "दूरसञ्चार", "टेलिकम", "नेटवर्क", "वाइफाइ", "साइबर", "ड्रोन", "राउटर",
  "स्मार्टफोन", "एनसेल", "नेपाल टेलिकम", "स्टार्टअप",
];

// Crime/gambling reports on this feed routinely mention "software company"/"digital" as a
// front the perpetrators used (e.g. "under the guise of a software company, an online
// betting ring was arrested") — a genuine keyword match in the title that still isn't tech
// news. These exclude a title outright regardless of a RELEVANT_KEYWORDS match.
const EXCLUDE_KEYWORDS = ["सट्टेबाजी", "गिरोह", "पक्राउ", "बहानामा", "ठगी", "जालसाजी"];

const REVALIDATE_SECONDS = 15 * 60; // matches the other Nepali news ticker's cadence
const FRESHNESS_CUTOFF_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const MIN_ITEMS = 3;

export interface NepaliTechNewsItem {
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
    .replace(/&amp;nbsp;|&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripCdata(raw: string): string {
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

// Title-only, deliberately — techpana.com's descriptions often mention "software"/"digital"
// incidentally (e.g. a crime story about a fake software-company front, or a pseudoscience
// story framed around "digital platforms" spreading it), which matched the keyword list
// without the story itself being tech news. Titles are a much more reliable signal.
function isRelevant(item: { title: string }): boolean {
  const haystack = ` ${item.title} `.toLowerCase();
  if (EXCLUDE_KEYWORDS.some((kw) => haystack.includes(kw.toLowerCase()))) return false;
  return RELEVANT_KEYWORDS.some((kw) => haystack.includes(kw.toLowerCase()));
}

export async function getNepaliTechNews(limit = 6): Promise<NepaliTechNewsItem[]> {
  const res = await fetch(FEED_URL, {
    // techpana.com's WAF 403s requests with no User-Agent at all — any identifying UA works.
    headers: { "User-Agent": "LogMonitorNewsTicker/1.0" },
    next: { revalidate: REVALIDATE_SECONDS },
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
