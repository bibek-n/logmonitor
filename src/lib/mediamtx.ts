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
