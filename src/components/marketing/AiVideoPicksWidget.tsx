import { PlayCircle } from "lucide-react";
import { MKT } from "@/lib/marketingTheme";
import { getFeaturedAiVideos } from "@/lib/aiVideoFeed";

// Server Component, self-fetching — the "changes once a day" cadence comes from the fetch
// revalidation in aiVideoFeed.ts, not a client-side timer, so no polling is needed here
// (unlike DevAiNewsWidget's 30-minute cadence, which does need one). Featuring just one
// video (rather than three squeezed into this ~320px sidebar column) gives it a much
// bigger, more legible thumbnail.
export async function AiVideoPicksWidget() {
  const videos = await getFeaturedAiVideos(1);
  if (videos.length === 0) return null;

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${MKT.border}`,
        borderRadius: 12,
        padding: "1.25rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: "0.9rem" }}>
        <PlayCircle size={17} style={{ color: MKT.primary }} />
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: MKT.ink, margin: 0 }}>AI Video Picks</h3>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${videos.length}, 1fr)` }}>
        {videos.map((video) => (
          <a
            key={`${video.platform}-${video.videoId}`}
            href={video.watchUrl}
            target="_blank"
            rel="noreferrer noopener"
            style={{ textDecoration: "none", minWidth: 0 }}
          >
            <div style={{ position: "relative", width: "100%", borderRadius: 10, overflow: "hidden", background: MKT.surfaceAlt, aspectRatio: "16 / 9" }}>
              {video.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.15)",
                }}
              >
                <PlayCircle size={34} color="#fff" />
              </div>
            </div>
            <div style={{ marginTop: "0.65rem" }}>
              <div
                style={{
                  fontSize: "0.92rem",
                  fontWeight: 600,
                  color: MKT.ink,
                  lineHeight: 1.35,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {video.title}
              </div>
              <div style={{ fontSize: "0.76rem", color: MKT.inkMuted, marginTop: "0.3rem" }}>{video.sourceName} &middot; {video.platform}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
