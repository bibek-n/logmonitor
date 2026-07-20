"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import { Play, FileText, Mail } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { MKT } from "@/lib/marketingTheme";

/**
 * Click-to-play video card for the homepage. Nothing (iframe or <video>) is mounted
 * until the user presses Play, so the embed is lazy by construction — no separate
 * lazy-loading library needed.
 *
 * `video` is always resolved server-side by the caller (see itOpsVideoFeed.ts,
 * fetched in page.tsx) before this Client Component ever mounts — there's no local
 * placeholder/default here on purpose: a previous hardcoded mp4 default pointed at a
 * file that was never actually uploaded, so the player silently never worked. The
 * caller only renders this component once it has a real video to show.
 */
type VideoSource =
  | { type: "youtube"; videoId: string; title: string }
  | { type: "vimeo"; videoId: string; title: string }
  | { type: "mp4"; src: string; poster: string; title: string };

interface DemoVideoSectionProps {
  video: VideoSource;
  title: string;
  description: string;
  watchDemoLabel: string;
  documentationLabel: string;
  contactSalesLabel: string;
}

export function DemoVideoSection({
  video,
  title,
  description,
  watchDemoLabel,
  documentationLabel,
  contactSalesLabel,
}: DemoVideoSectionProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const play = useCallback(() => setIsPlaying(true), []);

  const handleThumbnailKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        play();
      }
    },
    [play],
  );

  return (
    <section aria-labelledby="demo-video-heading" style={{ marginTop: "2rem" }}>
      <div
        style={{
          background: "#fff",
          border: `1px solid ${MKT.border}`,
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          padding: "1.25rem",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            borderRadius: 8,
            overflow: "hidden",
            background: MKT.ink,
          }}
        >
          {isPlaying ? (
            <VideoPlayer video={video} />
          ) : (
            <button
              type="button"
              onClick={play}
              onKeyDown={handleThumbnailKeyDown}
              aria-label={watchDemoLabel}
              className="group"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: "none",
                padding: 0,
                margin: 0,
                cursor: "pointer",
                background: "transparent",
              }}
            >
              {video.type === "mp4" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.poster}
                  alt=""
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
              {video.type === "youtube" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`}
                  alt=""
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
              {video.type === "vimeo" && (
                <div style={{ position: "absolute", inset: 0, background: MKT.ink }} />
              )}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(15, 23, 42, 0.28)",
                  transition: "background 0.15s ease",
                }}
                className="group-hover:bg-black/40"
              >
                <span
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: MKT.primary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                    transition: "transform 0.15s ease, background 0.15s ease",
                  }}
                  className="hover:scale-105 hover:brightness-110"
                >
                  <Play size={30} color="#fff" fill="#fff" style={{ marginLeft: 4 }} />
                </span>
              </span>
            </button>
          )}
        </div>

        <div style={{ marginTop: "1.25rem" }}>
          <h2 id="demo-video-heading" style={{ fontSize: "1.5rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.6rem" }}>
            {title}
          </h2>
          <p style={{ color: MKT.inkMuted, fontSize: "0.95rem", lineHeight: 1.6, maxWidth: 640, marginBottom: "1.25rem" }}>
            {description}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={play}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                background: MKT.primary,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0.65rem 1.25rem",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              className="hover:brightness-110"
            >
              <Play size={15} fill="#fff" /> {watchDemoLabel}
            </button>
            <Link
              href="/support"
              className="hover:bg-slate-50"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "#fff",
                color: MKT.ink,
                border: `1px solid ${MKT.border}`,
                borderRadius: 8,
                padding: "0.65rem 1.25rem",
                fontWeight: 600,
                fontSize: "0.9rem",
                textDecoration: "none",
                transition: "background 0.15s ease",
              }}
            >
              <FileText size={15} /> {documentationLabel}
            </Link>
            <Link
              href="/contact"
              className="hover:bg-slate-50"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "#fff",
                color: MKT.ink,
                border: `1px solid ${MKT.border}`,
                borderRadius: 8,
                padding: "0.65rem 1.25rem",
                fontWeight: 600,
                fontSize: "0.9rem",
                textDecoration: "none",
                transition: "background 0.15s ease",
              }}
            >
              <Mail size={15} /> {contactSalesLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function VideoPlayer({ video }: { video: VideoSource }) {
  if (video.type === "youtube") {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0`}
        title={video.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
      />
    );
  }

  if (video.type === "vimeo") {
    return (
      <iframe
        src={`https://player.vimeo.com/video/${video.videoId}?autoplay=1`}
        title={video.title}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
      />
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      src={video.src}
      poster={video.poster}
      title={video.title}
      controls
      autoPlay
      playsInline
      preload="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "#000" }}
    >
      <track kind="captions" />
    </video>
  );
}
