// "IT Ops & Security" video pick for the homepage demo slot - pulls the latest uploads
// from established networking/cybersecurity education channels (no API key needed, same
// public YouTube RSS approach as aiVideoFeed.ts) and rotates which one is featured once a
// day. This replaced a hardcoded local mp4 placeholder that never had a real file behind
// it (see DemoVideoSection.tsx) - a real, always-fresh YouTube video that's guaranteed to
// actually play is strictly better than a broken "product demo" placeholder.
//
// Deliberately NOT claiming to be Tulips Unified Admin Center's own product demo footage (no
// such footage exists yet) - framed on the page as a curated IT ops/security pick instead,
// so the copy stays honest about what's actually playing.
const YOUTUBE_CHANNELS = [
  { id: "UC9x0AN7BWHpCDHSm9NiJFJQ", name: "NetworkChuck" },
  { id: "UCVeW9qkBjo3zosnqUbG7CFw", name: "John Hammond" },
  { id: "UCkefXKtInZ9PLsoGRtml2FQ", name: "Professor Messer" },
  { id: "UCa6eh7gCkpPo5XXUDfygQQA", name: "IppSec" },
];

const REVALIDATE_SECONDS = 24 * 60 * 60; // 1 day - matches the "changes once a day" requirement

export interface FeaturedItOpsVideo {
  videoId: string;
  title: string;
  sourceName: string;
  watchUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
  publishedAt: string | null;
}

interface RawEntry {
  videoId: string;
  title: string;
  sourceName: string;
  publishedAt: string | null;
}

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

function stripCdata(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return (match ? match[1] : trimmed).trim();
}

async function fetchYouTubeChannel(channel: { id: string; name: string }): Promise<RawEntry[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const entryBlocks = xml.match(/<entry>[\s\S]*?<\/entry>/gi) ?? [];
    return entryBlocks
      .map((block): RawEntry | null => {
        const videoId = extractTag(block, "yt:videoId");
        const title = extractTag(block, "title");
        const publishedAt = extractTag(block, "published");
        if (!videoId || !title) return null;
        return { videoId, title: stripCdata(title), sourceName: channel.name, publishedAt };
      })
      .filter((e): e is RawEntry => e !== null);
  } catch {
    return [];
  }
}

function toFeaturedVideo(entry: RawEntry): FeaturedItOpsVideo {
  return {
    ...entry,
    watchUrl: `https://www.youtube.com/watch?v=${entry.videoId}`,
    embedUrl: `https://www.youtube.com/embed/${entry.videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${entry.videoId}/mqdefault.jpg`,
  };
}

// Deterministic by calendar date (UTC) rather than random - the same video is featured all
// day for every visitor, and the pick naturally advances by one slot each day.
function dailyWindow<T>(pool: T[], count: number): T[] {
  if (pool.length <= count) return pool;
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  const start = daysSinceEpoch % pool.length;
  return Array.from({ length: count }, (_, i) => pool[(start + i) % pool.length]);
}

export async function getFeaturedItOpsVideos(count = 1): Promise<FeaturedItOpsVideo[]> {
  const results = await Promise.all(YOUTUBE_CHANNELS.map(fetchYouTubeChannel));
  const pool = results.flat().sort((a, b) => {
    const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const db_ = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return db_ - da;
  });
  if (pool.length === 0) return [];

  return dailyWindow(pool, count).map(toFeaturedVideo);
}
