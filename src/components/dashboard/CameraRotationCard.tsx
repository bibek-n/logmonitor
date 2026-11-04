"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera as CameraIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LiveViewModal } from "@/components/cameras/LiveViewModal";

interface CameraRow {
  Id: number;
  ChannelName: string;
  Label: string | null;
  Location: string | null;
  NvrName: string;
  Status: string;
}

const TILES_PER_PAGE = 8;
const ROTATE_MS = 5 * 60 * 1000; // also re-fetches the camera list on each tick, so a newly added/removed camera is picked up within one rotation
const THUMBNAIL_REFRESH_MS = 30 * 1000; // matches the main Cameras page's own snapshot refresh cadence

type Tone = "success" | "info" | "warning" | "danger" | "neutral";

function statusTone(status: string): Tone {
  if (status === "Online") return "success";
  if (status === "Error" || status === "Offline") return "danger";
  return "neutral";
}

function statusLabel(status: string): string {
  return status === "Online" ? "Live" : status === "Offline" ? "Offline" : status;
}

// Shows 4 camera snapshots at a time, cycling through every configured camera 4-at-a-time
// on a 5-minute timer - a live WebRTC feed per tile (like the main Cameras page's modal) would
// mean N simultaneous WHEP sessions running continuously on every Overview page view, which
// the Cameras page deliberately avoids for the exact same reason (see its own thumbnail-grid
// comment). Snapshots give an always-fresh-enough glance at every camera without that cost;
// clicking a tile still opens the real live WebRTC view via the same LiveViewModal the Cameras
// page uses, for anyone who needs to actually watch one.
export function CameraRotationCard() {
  const [cameras, setCameras] = useState<CameraRow[] | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [thumbnailTick, setThumbnailTick] = useState(0);
  const [liveCamera, setLiveCamera] = useState<CameraRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadAndAdvance() {
      try {
        const res = await fetch("/api/admin/dashboard/cameras");
        const data = await res.json();
        if (cancelled || !data.ok) return;
        const list: CameraRow[] = data.data;
        setCameras(list);
        const totalPages = Math.max(1, Math.ceil(list.length / TILES_PER_PAGE));
        setPageIndex((p) => (p + 1) % totalPages);
      } catch {
        // keep showing the last-known batch rather than clearing it on a transient failure
      }
    }
    loadAndAdvance();
    const rotateInterval = setInterval(loadAndAdvance, ROTATE_MS);
    const thumbnailInterval = setInterval(() => setThumbnailTick((t) => t + 1), THUMBNAIL_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(rotateInterval);
      clearInterval(thumbnailInterval);
    };
  }, []);

  const totalPages = cameras ? Math.max(1, Math.ceil(cameras.length / TILES_PER_PAGE)) : 1;
  const visible = cameras ? cameras.slice(pageIndex * TILES_PER_PAGE, pageIndex * TILES_PER_PAGE + TILES_PER_PAGE) : [];

  return (
    <Card className="h-full" hoverLift tilt3d>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.6rem" }}>
        <div className="flex items-center gap-2">
          <CameraIcon size={16} style={{ color: cameras && cameras.length > 0 ? "var(--primary)" : "var(--ink-muted)" }} />
          <h2 style={{ fontSize: "1.125rem", margin: 0 }}>Cameras</h2>
        </div>
        <Link href="/dashboard/cameras" style={{ fontSize: "0.78rem", color: "var(--primary)" }}>
          View all &rarr;
        </Link>
      </div>
      {cameras && cameras.length > TILES_PER_PAGE && (
        <p style={{ fontSize: "0.72rem", color: "var(--ink-muted)", margin: "0 0 0.6rem" }}>
          Showing {pageIndex * TILES_PER_PAGE + 1}-{pageIndex * TILES_PER_PAGE + visible.length} of {cameras.length} - rotates every 5 minutes
        </p>
      )}
      {!cameras ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>Loading...</p>
      ) : cameras.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>
          No cameras configured. <Link href="/dashboard/cameras" style={{ color: "var(--primary)" }}>Add an NVR</Link> to get started.
        </p>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {visible.map((cam) => (
            <div
              key={cam.Id}
              onClick={() => setLiveCamera(cam)}
              style={{ position: "relative", aspectRatio: "16 / 9", background: "#000", borderRadius: 6, overflow: "hidden", cursor: "pointer" }}
            >
              <img
                src={`/api/admin/nvr/cameras/${cam.Id}/thumbnail?t=${thumbnailTick}`}
                alt={cam.Label || cam.ChannelName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/camera-placeholder.svg";
                }}
              />
              <div style={{ position: "absolute", top: 4, left: 4 }}>
                <Badge tone={statusTone(cam.Status)}>{statusLabel(cam.Status)}</Badge>
              </div>
              <div
                style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "linear-gradient(transparent, rgba(0,0,0,0.75))",
                  padding: "0.9rem 0.4rem 0.3rem", fontSize: "0.68rem", color: "#fff",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {cam.Label || cam.ChannelName}
              </div>
            </div>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center gap-1" style={{ justifyContent: "center", marginTop: "0.6rem" }}>
          {Array.from({ length: totalPages }, (_, i) => (
            <span
              key={i}
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: i === pageIndex ? "var(--primary)" : "var(--border)",
              }}
            />
          ))}
        </div>
      )}
      {liveCamera && (
        <LiveViewModal cameraId={liveCamera.Id} channelName={liveCamera.Label || liveCamera.ChannelName} onClose={() => setLiveCamera(null)} />
      )}
    </Card>
  );
}
