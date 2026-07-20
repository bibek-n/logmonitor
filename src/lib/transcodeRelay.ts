import { spawn, type ChildProcess } from "child_process";
import { addPublishTargetPath, removePublishTargetPath, rtspPublishUrl } from "./mediamtx";

// On-demand H.265->H.264 transcode relay for cameras whose NVR stream is HEVC, which no
// browser's WebRTC stack can decode (confirmed live: 7 of 16 channels on this NVR are HEVC).
// ffmpeg pulls the camera's real RTSP source and republishes an H.264 copy into a MediaMTX
// path via RTSP publish, so the existing WHEP proxy (webrtc/route.ts, playback/webrtc/route.ts)
// can serve it exactly like any native H.264 channel. Relays only run while someone is
// actually watching - they cost real, continuous CPU, so they must never be "always on".
//
// KNOWN LIMITATION: relay processes are plain child_process.spawn calls, not wrapped in a
// Windows Job Object, so an abrupt IIS app pool recycle (not a graceful shutdown) can orphan
// a running ffmpeg process rather than killing it. The 30s idle-timeout only protects against
// this while the Node process hosting it is still alive. Acceptable for now since this only
// runs while a human is actively watching an HEVC camera or has an open playback session
// (both bounded, short-lived, human-triggered) - worth revisiting if orphaned ffmpeg.exe
// processes are ever observed accumulating on the server.

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";
const LIVE_IDLE_TIMEOUT_MS = 30_000; // matches sourceOnDemandCloseAfter used for the raw live channels
const READY_POLL_INTERVAL_MS = 500;
const READY_TIMEOUT_MS = 15_000; // matches sourceOnDemandStartTimeout used for the raw live channels
const MEDIAMTX_API_BASE = "http://127.0.0.1:9997";

interface RelayHandle {
  process: ChildProcess;
  refCount: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
  readyPromise: Promise<void>;
  stderrTail: string[];
}

const activeRelays = new Map<string, RelayHandle>();

const STDERR_TAIL_LINES = 20;

// ffmpeg's own stderr carries the actual reason a relay failed (auth rejected by the NVR,
// unsupported source codec, connection refused, etc.) - discarding it (the original
// stdio:"ignore" for stderr) meant a real production failure left zero trace anywhere. Kept
// as a small rolling tail per process, logged to console (captured in the iisnode stderr log)
// whenever the process exits or waitUntilReady gives up, not on every line.
function spawnFfmpeg(sourceRtspUrl: string, pathName: string): { proc: ChildProcess; stderrTail: string[] } {
  const target = rtspPublishUrl(pathName);
  const proc = spawn(
    FFMPEG_PATH,
    [
      "-rtsp_transport", "tcp",
      "-i", sourceRtspUrl,
      "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-g", "50",
      "-c:a", "aac", "-ar", "48000", "-b:a", "64k",
      "-f", "rtsp", "-rtsp_transport", "tcp",
      target,
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  const stderrTail: string[] = [];
  proc.stderr?.on("data", (chunk: Buffer) => {
    const lines = chunk.toString("utf8").split("\n").filter(Boolean);
    stderrTail.push(...lines);
    if (stderrTail.length > STDERR_TAIL_LINES) stderrTail.splice(0, stderrTail.length - STDERR_TAIL_LINES);
  });
  return { proc, stderrTail };
}

async function pathIsReady(pathName: string): Promise<boolean> {
  try {
    const res = await fetch(`${MEDIAMTX_API_BASE}/v3/paths/get/${pathName}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ready === true;
  } catch {
    return false;
  }
}

async function waitUntilReady(pathName: string, proc: ChildProcess, stderrTail: string[]): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      console.error(`[transcodeRelay] ffmpeg for "${pathName}" exited early (code ${proc.exitCode}). Last stderr:\n${stderrTail.join("\n")}`);
      throw new Error("The transcode process exited before the stream became ready - the camera's source stream may be unavailable.");
    }
    if (await pathIsReady(pathName)) return;
    await new Promise((r) => setTimeout(r, READY_POLL_INTERVAL_MS));
  }
  console.error(`[transcodeRelay] Timed out waiting for "${pathName}" to become ready. Last stderr:\n${stderrTail.join("\n")}`);
  throw new Error("Timed out waiting for the transcoded stream to become ready.");
}

async function startRelay(pathName: string, sourceRtspUrl: string): Promise<RelayHandle> {
  await addPublishTargetPath(pathName);
  const { proc, stderrTail } = spawnFfmpeg(sourceRtspUrl, pathName);
  console.log(`[transcodeRelay] Started ffmpeg pid=${proc.pid} for "${pathName}"`);
  const handle: RelayHandle = {
    process: proc,
    refCount: 0,
    idleTimer: null,
    readyPromise: waitUntilReady(pathName, proc, stderrTail),
    stderrTail,
  };
  proc.on("exit", (code) => {
    console.log(`[transcodeRelay] ffmpeg pid=${proc.pid} for "${pathName}" exited (code ${code}).`);
    activeRelays.delete(pathName);
  });
  activeRelays.set(pathName, handle);
  return handle;
}

async function teardownRelay(pathName: string): Promise<void> {
  const handle = activeRelays.get(pathName);
  if (!handle) return;
  activeRelays.delete(pathName);
  handle.process.kill();
  await removePublishTargetPath(pathName);
}

// Shared, ref-counted relay for a live channel - multiple viewers of the same camera reuse
// one ffmpeg process rather than each spawning their own. Resolves once the transcoded
// stream is actually ready to be WHEP-connected to (not just once ffmpeg has been spawned).
export async function acquireLiveTranscode(pathName: string, sourceRtspUrl: string): Promise<void> {
  let handle = activeRelays.get(pathName);
  if (!handle) {
    handle = await startRelay(pathName, sourceRtspUrl);
  }
  handle.refCount++;
  if (handle.idleTimer) {
    clearTimeout(handle.idleTimer);
    handle.idleTimer = null;
  }
  await handle.readyPromise;
}

export function releaseLiveTranscode(pathName: string): void {
  const handle = activeRelays.get(pathName);
  if (!handle) return;
  handle.refCount = Math.max(0, handle.refCount - 1);
  if (handle.refCount === 0 && !handle.idleTimer) {
    handle.idleTimer = setTimeout(() => {
      void teardownRelay(pathName);
    }, LIVE_IDLE_TIMEOUT_MS);
  }
}

// Playback sessions get their own uniquely-named path per session (see playbackPathName) -
// no sharing, no ref-counting, torn down immediately when the session ends rather than after
// an idle grace period.
export async function startPlaybackTranscode(pathName: string, sourceRtspUrl: string): Promise<void> {
  const handle = await startRelay(pathName, sourceRtspUrl);
  handle.refCount = 1;
  await handle.readyPromise;
}

export async function stopPlaybackTranscode(pathName: string): Promise<void> {
  await teardownRelay(pathName);
}
