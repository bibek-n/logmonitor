const MEDIAMTX_API_BASE = "http://127.0.0.1:9997";
const MEDIAMTX_WHEP_BASE = "http://127.0.0.1:8889";

// Live-view camera channels use fixed, preconfigured MediaMTX paths (channel1..channel16,
// set up outside this repo in C:\mediamtx\mediamtx.yml). Recording playback has no fixed
// path to reuse - each playback session needs its own on-demand path pointing at a
// recording-specific RTSP URL (a distinct time range every time), so this registers and
// tears down a path via MediaMTX's runtime control API instead.
export function playbackPathName(cameraId: number, sessionId: string): string {
  return `playback_${cameraId}_${sessionId}`;
}

export async function addPlaybackPath(pathName: string, rtspSourceUrl: string): Promise<void> {
  const res = await fetch(`${MEDIAMTX_API_BASE}/v3/config/paths/add/${pathName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: rtspSourceUrl, sourceOnDemand: true }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MediaMTX rejected the playback path (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
}

export async function removePlaybackPath(pathName: string): Promise<void> {
  await fetch(`${MEDIAMTX_API_BASE}/v3/config/paths/delete/${pathName}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(10000),
  }).catch(() => {
    // Best-effort cleanup - a dangling unused path config is harmless clutter, not worth
    // failing the caller's request over.
  });
}

// A plain publish-target path (no `source` - MediaMTX won't auto-create paths for an RTSP
// publisher unless the path was registered first, confirmed live: publishing to an
// unregistered path name returns "path not found"). Used by transcodeRelay.ts to register a
// destination for its ffmpeg process to RTSP-publish the transcoded H.264 output into, before
// starting ffmpeg - the opposite direction from addPlaybackPath, which registers MediaMTX as
// the one pulling from a source URL.
//
// Idempotent: "path already exists" is treated as success, not an error - confirmed live that
// a path can outlive the Node process that registered it (a diagnostic script that exits
// before its own cleanup timer fires, or an app-pool recycle) while MediaMTX's own config
// keeps the stale entry, so a fresh acquire from a new process would otherwise 400 forever on
// a path nothing is actually publishing to anymore. Two concurrent viewers racing to acquire
// the same brand-new path hit the same "already exists" response from each other and both
// need this to be a no-op, not a failure.
export async function addPublishTargetPath(pathName: string): Promise<void> {
  const res = await fetch(`${MEDIAMTX_API_BASE}/v3/config/paths/add/${pathName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 400 && text.includes("already exists")) return;
    throw new Error(`MediaMTX rejected the publish-target path (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
}

export async function removePublishTargetPath(pathName: string): Promise<void> {
  await fetch(`${MEDIAMTX_API_BASE}/v3/config/paths/delete/${pathName}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(10000),
  }).catch(() => {
    // Best-effort cleanup - same reasoning as removePlaybackPath.
  });
}

export function rtspPublishUrl(pathName: string): string {
  return `rtsp://127.0.0.1:8554/${pathName}`;
}

export async function pathExists(pathName: string): Promise<boolean> {
  try {
    const res = await fetch(`${MEDIAMTX_API_BASE}/v3/paths/get/${pathName}`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

// Live channels are normally pre-declared as static paths in mediamtx.yml (outside this repo,
// hand-maintained) - confirmed live that a channel missing from that file (e.g. one ONVIF
// never listed, only discovered via the gap-fill logic in syncNvrCameras) has NO path at all
// and 404s ("path not found") the moment a viewer tries to watch it, even though its RTSP
// source is perfectly reachable. Rather than depending on the YAML always being kept in sync
// with whatever channels the DB/ONVIF/gap-fill logic knows about, this registers the path via
// the same runtime API playback already uses, on first use, so a channel works immediately
// without ever needing to hand-edit that file again.
export async function ensureLivePullPath(pathName: string, sourceRtspUrl: string): Promise<void> {
  if (await pathExists(pathName)) return;
  const res = await fetch(`${MEDIAMTX_API_BASE}/v3/config/paths/add/${pathName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: sourceRtspUrl, sourceOnDemand: true }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MediaMTX rejected the live path (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
}

export async function proxyWhepOffer(pathName: string, offerSdp: string): Promise<{ ok: true; answerSdp: string } | { ok: false; status: number; error: string }> {
  const res = await fetch(`${MEDIAMTX_WHEP_BASE}/${pathName}/whep`, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: offerSdp,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 300) };
  return { ok: true, answerSdp: text };
}
