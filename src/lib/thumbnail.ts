import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { getDb, sql } from "@/lib/db";
import { probeVideoCodec } from "@/lib/videoCodecProbe";

// Grabs a single still frame from a camera's RTSP feed via FFmpeg (same binary already used
// for the live-view pipeline - see hlsStream references in the git history for why this is
// called by absolute path, not "ffmpeg" on PATH: the IIS worker process's environment
// doesn't pick up PATH changes made after the service started). Connects directly to the NVR
// rather than going through MediaMTX, since MediaMTX only pulls a stream on-demand while
// someone is actually watching - thumbnails need to work with nobody live-viewing.
const FFMPEG_PATH = process.env.FFMPEG_PATH || "C:\\ffmpeg\\bin\\ffmpeg.exe";
const THUMBNAIL_DIR = path.join(os.tmpdir(), "logmonitor-thumbnails");
const CACHE_TTL_MS = 30 * 1000;
const GRAB_TIMEOUT_MS = 10 * 1000;
// How long a stale frame is still worth serving immediately while a fresh one is grabbed in
// the background. Without this, every camera grid poll (every 30s, see CamerasClient's
// thumbnailTick) re-blocked on a live FFmpeg grab for every single camera, all serialized
// behind MAX_CONCURRENT_GRABS - with enough cameras that queue alone could take a minute,
// which is what made the page (often the first thing loaded right after signing in) feel
// like login itself was hanging.
const STALE_SERVE_MS = 10 * 60 * 1000;

interface CacheEntry {
  buffer: Buffer;
  fetchedAt: number;
}

const cache = new Map<number, CacheEntry>();
const inFlight = new Map<number, Promise<Buffer>>();

// Same "cap concurrent connections to the NVR" reasoning as the old snapshot pipeline (see
// git history) - a camera grid loading 15 thumbnails at once shouldn't open 15 simultaneous
// RTSP connections to a device that may only handle a couple at a time.
const MAX_CONCURRENT_GRABS = 2;
let activeGrabs = 0;
const waitQueue: Array<() => void> = [];

function acquireGrabSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (activeGrabs < MAX_CONCURRENT_GRABS) {
        activeGrabs++;
        resolve(() => {
          activeGrabs--;
          const next = waitQueue.shift();
          if (next) next();
        });
      } else {
        waitQueue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

function grabFrame(cameraId: number, rtspUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
    const outFile = path.join(THUMBNAIL_DIR, `${cameraId}.jpg`);
    const args = ["-rtsp_transport", "tcp", "-i", rtspUrl, "-frames:v", "1", "-q:v", "4", "-y", outFile];
    const proc = spawn(FFMPEG_PATH, args, { stdio: ["ignore", "ignore", "ignore"] });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Timed out grabbing a frame."));
    }, GRAB_TIMEOUT_MS);

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
        return;
      }
      fs.readFile(outFile, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });
  });
}

// NvrCameras.Status is otherwise only written once, during a manual NVR "Re-sync" - a camera
// that goes dark afterward would show "Online"/"Live" on the grid forever. Every real grab
// attempt (foreground or background-refresh alike) is itself a live probe of whether the
// camera is actually producing video, so piggyback the status write on it instead of running
// a second, separate poller against the same NVR.
async function setCameraStatus(cameraId: number, status: "Online" | "Offline") {
  try {
    const db = await getDb();
    await db
      .request()
      .input("id", sql.Int, cameraId)
      .input("status", sql.NVarChar, status)
      .query("UPDATE NvrCameras SET Status = @status WHERE Id = @id AND Status <> @status");
  } catch {
    // Best-effort - a DB hiccup here shouldn't fail the thumbnail response itself.
  }
}

// NvrCameras.VideoCodec is, like Status, only ever written during a manual "Re-sync" - and
// the live-view/playback routes (webrtc/route.ts, playback/route.ts) trust that stored value
// to decide whether a channel needs the HEVC transcode relay. Confirmed live: several channels
// that were H.264 at last sync are now HEVC (an NVR-side stream profile change), so the stored
// value was silently wrong - live view sent raw HEVC straight to the browser's WebRTC stack,
// which can't decode it, while the NVR's own app (which decodes HEVC natively) showed it fine.
// Re-probed on the same cadence as Status/thumbnails, gated through the same concurrency
// limiter as a real grab so this doesn't add unbounded extra connections to the NVR.
async function refreshCameraCodec(cameraId: number, rtspUrl: string) {
  const release = await acquireGrabSlot();
  try {
    const codec = await probeVideoCodec(rtspUrl);
    if (!codec) return; // couldn't determine this time - keep whatever value it already had
    const db = await getDb();
    await db
      .request()
      .input("id", sql.Int, cameraId)
      .input("codec", sql.NVarChar, codec)
      .query("UPDATE NvrCameras SET VideoCodec = @codec WHERE Id = @id AND (VideoCodec <> @codec OR VideoCodec IS NULL)");
  } catch {
    // Best-effort - a DB or probe hiccup here shouldn't fail the thumbnail response itself.
  } finally {
    release();
  }
}

function startGrab(cameraId: number, rtspUrl: string): Promise<Buffer> {
  const promise = (async () => {
    const release = await acquireGrabSlot();
    try {
      const buffer = await grabFrame(cameraId, rtspUrl);
      cache.set(cameraId, { buffer, fetchedAt: Date.now() });
      void setCameraStatus(cameraId, "Online");
      void refreshCameraCodec(cameraId, rtspUrl);
      return buffer;
    } catch (err) {
      void setCameraStatus(cameraId, "Offline");
      throw err;
    } finally {
      release();
      inFlight.delete(cameraId);
    }
  })();
  inFlight.set(cameraId, promise);
  return promise;
}

export async function getThumbnail(cameraId: number, rtspUrl: string): Promise<Buffer> {
  const cached = cache.get(cameraId);
  const age = cached ? Date.now() - cached.fetchedAt : Infinity;

  if (cached && age < CACHE_TTL_MS) {
    return cached.buffer;
  }

  // A cached frame that's gone stale is still far better than blocking the response on a
  // live grab: return it immediately and let a background grab (deduped via `inFlight`, same
  // as the blocking path) refresh it for whoever asks next.
  if (cached && age < STALE_SERVE_MS) {
    if (!inFlight.has(cameraId)) startGrab(cameraId, rtspUrl).catch(() => {});
    return cached.buffer;
  }

  const existing = inFlight.get(cameraId);
  if (existing) return existing;

  return startGrab(cameraId, rtspUrl);
}
