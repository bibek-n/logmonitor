// "AI tools & modules" video picks for the home page — pulls the latest uploads from a few
// free, publicly-accessible video sources across two different platforms (no API key on
// either) and rotates which 3 are featured once a day. Embedding via each platform's own
// oEmbed/iframe player is the only legitimate "free media" route — actually downloading/
// rehosting video files would violate both platforms' terms and isn't necessary.
//
// Reality check on "multi-platform": YouTube has an abundance of dedicated AI-tool-review
// channels; Vimeo does not have an equivalent niche, so its one contribution here
// (Break Through Tech AI) is education/program content that's AI-adjacent rather than a
// tools review — included for genuine platform diversity, not because it's a perfect
// topical match.
const YOUTUBE_CHANNELS = [
  { id: "UChpleBmo18P08aKCIgti38g", name: "Matt Wolfe" },
  { id: "UCbfYPyITQ-7l4upoX8nvctg", name: "Two Minute Papers" },
  { id: "UCNJ1Ymd5yFuUPtn21xtRbbw", name: "AI Explained" },
];
const VIMEO_CHANNELS = [{ slug: "breakthroughtech", name: "Break Through Tech AI" }];

const REVALIDATE_SECONDS = 24 * 60 * 60; // 1 day — matches the "changes once a day" requirement
const FEATURED_COUNT = 3;

export type VideoPlatform = "YouTube" | "Vimeo";

export interface FeaturedVideo {
  platform: VideoPlatform;
  videoId: string;
  title: string;
  sourceName: string;
  watchUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
  publishedAt: string | null;
}

interface RawEntry {
  platform: VideoPlatform;
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
        return { platform: "YouTube", videoId, title: stripCdata(title), sourceName: channel.name, publishedAt };
      })
      .filter((e): e is RawEntry => e !== null);
  } catch {
    return [];
  }
}

async function fetchVimeoChannel(channel: { slug: string; name: string }): Promise<RawEntry[]> {
  try {
    const res = await fetch(`https://vimeo.com/channels/${channel.slug}/videos/rss`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
    return itemBlocks
      .map((block): RawEntry | null => {
        const link = extractTag(block, "link");
        const title = extractTag(block, "title");
        const publishedAt = extractTag(block, "pubDate");
        const idMatch = link?.match(/vimeo\.com\/(\d+)/);
        if (!idMatch || !title) return null;
        return { platform: "Vimeo", videoId: idMatch[1], title: stripCdata(title), sourceName: channel.name, publishedAt };
      })
      .filter((e): e is RawEntry => e !== null);
  } catch {
    return [];
  }
}

function toFeaturedVideo(entry: RawEntry): FeaturedVideo {
  if (entry.platform === "YouTube") {
    return {
      ...entry,
      watchUrl: `https://www.youtube.com/watch?v=${entry.videoId}`,
      embedUrl: `https://www.youtube.com/embed/${entry.videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${entry.videoId}/mqdefault.jpg`,
    };
  }
  return {
    ...entry,
    watchUrl: `https://vimeo.com/${entry.videoId}`,
    embedUrl: `https://player.vimeo.com/video/${entry.videoId}`,
    // Vimeo doesn't expose a predictable static thumbnail URL pattern like YouTube's — this
    // calls their official keyless oEmbed endpoint, which returns one directly.
    thumbnailUrl: "",
  };
}

async function resolveVimeoThumbnail(video: FeaturedVideo): Promise<FeaturedVideo> {
  if (video.platform !== "Vimeo") return video;
  try {
    const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(video.watchUrl)}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return video;
    const data = (await res.json()) as { thumbnail_url?: string };
    return data.thumbnail_url ? { ...video, thumbnailUrl: data.thumbnail_url } : video;
  } catch {
    return video;
  }
}

// Deterministic by calendar date (UTC) rather than random — the same 3 videos are featured
// all day for every visitor, and the window naturally advances by one slot each day.
function dailyWindow<T>(pool: T[], count: number): T[] {
  if (pool.length <= count) return pool;
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  const start = daysSinceEpoch % pool.length;
  return Array.from({ length: count }, (_, i) => pool[(start + i) % pool.length]);
}

export async function getFeaturedAiVideos(count = FEATURED_COUNT): Promise<FeaturedVideo[]> {
  const [youtubeResults, vimeoResults] = await Promise.all([
    Promise.all(YOUTUBE_CHANNELS.map(fetchYouTubeChannel)),
    Promise.all(VIMEO_CHANNELS.map(fetchVimeoChannel)),
  ]);

  const pool = [...youtubeResults.flat(), ...vimeoResults.flat()].sort((a, b) => {
    const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const db_ = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return db_ - da;
  });
  if (pool.length === 0) return [];

  const chosen = dailyWindow(pool, count).map(toFeaturedVideo);
  return Promise.all(chosen.map(resolveVimeoThumbnail));
}
