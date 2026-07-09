import { runPing, parsePingSummary } from "./networkTools";
import { getDb, sql } from "./db";

export interface ServerPreset {
  label: string;
  downloadUrl: string;
  uploadUrl: string;
}

function ooklaMini(label: string, host: string): ServerPreset {
  return {
    label,
    downloadUrl: `http://${host}/speedtest/random2000x2000.jpg`,
    uploadUrl: `http://${host}/speedtest/upload.php`,
  };
}

// Every preset below is verified to support BOTH download and upload — Cloudflare via its own
// documented API, everything else via the real Ookla "Speedtest Mini" server software that ISPs
// run (the same protocol desktop/mobile Speedtest apps use), discovered via Ookla's public
// server list and confirmed reachable from this server for both directions.
export const INTERNATIONAL_SERVERS: ServerPreset[] = [
  { label: "Cloudflare (global anycast)", downloadUrl: "https://speed.cloudflare.com/__down?bytes=25000000", uploadUrl: "https://speed.cloudflare.com/__up" },
  ooklaMini("Sweden — Bahnhof (Stockholm)", "sto-ste-speedtest1.bahnhof.net:8080"),
  ooklaMini("UK — Truespeed", "speedtst.countybroadband.net:8080"),
  ooklaMini("Germany — Telta Citynetz", "speedtest-srb.telta.de.prod.hosts.ooklaserver.net:8080"),
  ooklaMini("Singapore — Pacific Internet", "speedtest2.pacificinternet.com.prod.hosts.ooklaserver.net:8080"),
  ooklaMini("Japan — Rakuten Mobile (Tokyo)", "ookla2.mbspeed.net:8080"),
  ooklaMini("India — Immortal Broadband", "speed.immortalbroadband.com.prod.hosts.ooklaserver.net:8080"),
  ooklaMini("France — Orange", "reunion3.speedtest.orange.fr.prod.hosts.ooklaserver.net:8080"),
  ooklaMini("Australia — Optus (Broome)", "speedtest-broome.optusnet.com.au:8080"),
  ooklaMini("Canada — TekSavvy (Toronto)", "speedtest2-tor.teksavvy.com.prod.hosts.ooklaserver.net:8080"),
  ooklaMini("US — GeoLinks (Los Angeles)", "la-ookla.geolinks.com:8080"),
];

export const NEPAL_SERVERS: ServerPreset[] = [
  ooklaMini("Nepal Telecom", "speedtestktm.ntc.net.np:8080"),
  ooklaMini("WorldLink", "speedtest.wlink.com.np:8080"),
  ooklaMini("WorldLink (2)", "speedtest2.wlink.com.np:8080"),
  ooklaMini("Subisu (Thapathali)", "speedtest-dh.subisu.net.np:8080"),
  ooklaMini("Subisu (Kathmandu)", "speedtest-bl.subisu.net.np:8080"),
  ooklaMini("Ncell", "speedtest1.ncell.com.np:8080"),
  ooklaMini("DishHome", "speedtest.dishhome.com.np:8080"),
  ooklaMini("ClassicTech", "speedtest-srv.classic.com.np:8080"),
  ooklaMini("Himalayan Online Service (HONS)", "srv-sp.hons.net.np:8080"),
  ooklaMini("Islington College", "speedtest.islingtoncollege.edu.np:8080"),
];

function findPreset(rawTarget: string): ServerPreset | null {
  return [...INTERNATIONAL_SERVERS, ...NEPAL_SERVERS].find((p) => p.downloadUrl === rawTarget) ?? null;
}

export type ProgressEvent =
  | { phase: "ping"; status: "running" }
  | { phase: "ping"; status: "done"; avgMs: string; minMs: string; maxMs: string; lossPct: number }
  | { phase: "ping"; status: "failed"; error: string }
  | { phase: "download"; status: "running" | "done"; mbps: number; bytes: number; seconds: number }
  | { phase: "download"; status: "failed"; error: string }
  | { phase: "upload"; status: "running" | "done"; mbps: number; bytes: number; seconds: number }
  | { phase: "upload"; status: "failed"; error: string };

// Counts bytes as they stream in (via onBytes) rather than buffering the whole response — a
// request that hits the abort timeout mid-transfer still gets credit for whatever it actually
// received, instead of losing everything. This also drives live progress: the caller's running
// total updates continuously as chunks arrive, not just once at the very end.
async function fetchOnce(url: string, timeoutMs: number, onBytes: (n: number) => void): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let bytes = 0;
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      onBytes(value.byteLength);
    }
  } catch (err) {
    if (bytes === 0) throw err;
  } finally {
    clearTimeout(timer);
  }
  return bytes;
}

// Loops (a few requests in parallel per round) until enough bytes or time has accumulated —
// this lets a single big purpose-built file (Cloudflare) and a smaller ISP test image both
// produce a meaningful throughput reading. onProgress fires every ~250ms with the running total
// so the UI can show a live-updating number, like speedtest.com does.
export async function measureDownload(
  url: string,
  targetBytes = 20_000_000,
  maxSeconds = 10,
  onProgress?: (p: { mbps: number; bytes: number; seconds: number }) => void
): Promise<{ mbps: number; bytes: number; seconds: number }> {
  const start = Date.now();
  let totalBytes = 0;
  let lastError: unknown = null;
  const concurrency = 4;

  const tick = onProgress
    ? setInterval(() => {
        const seconds = (Date.now() - start) / 1000;
        onProgress({ mbps: (totalBytes * 8) / seconds / 1_000_000, bytes: totalBytes, seconds });
      }, 250)
    : null;

  try {
    while (totalBytes < targetBytes && (Date.now() - start) / 1000 < maxSeconds) {
      const remainingMs = Math.max(1000, maxSeconds * 1000 - (Date.now() - start));
      const results = await Promise.allSettled(
        Array.from({ length: concurrency }, () => fetchOnce(url, remainingMs, (n) => (totalBytes += n)))
      );
      const anySucceeded = results.some((r) => r.status === "fulfilled");
      if (!anySucceeded) {
        const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
        if (failed) lastError = failed.reason;
        break;
      }
    }
  } finally {
    if (tick) clearInterval(tick);
  }

  if (totalBytes === 0) {
    throw lastError instanceof Error ? lastError : new Error("No data received.");
  }

  const seconds = Math.max((Date.now() - start) / 1000, 0.001);
  const mbps = (totalBytes * 8) / seconds / 1_000_000;
  return { mbps, bytes: totalBytes, seconds };
}

// Uploads in a loop of smaller chunks (rather than one big POST) purely so there are natural
// checkpoints to report interim progress between requests — Node's fetch has no built-in
// upload-progress event, so this is the practical way to get a live-updating number here too.
export async function measureUpload(
  url: string,
  targetBytes = 8_000_000,
  maxSeconds = 10,
  onProgress?: (p: { mbps: number; bytes: number; seconds: number }) => void
): Promise<{ mbps: number; bytes: number; seconds: number }> {
  const start = Date.now();
  const chunkSize = 1_000_000;
  const chunk = new Uint8Array(chunkSize);
  let totalBytes = 0;
  let lastError: unknown = null;
  const concurrency = 2;

  while (totalBytes < targetBytes && (Date.now() - start) / 1000 < maxSeconds) {
    const remainingMs = Math.max(1000, maxSeconds * 1000 - (Date.now() - start));
    const results = await Promise.allSettled(
      Array.from({ length: concurrency }, async () => {
        const res = await fetch(url, { method: "POST", body: chunk, signal: AbortSignal.timeout(remainingMs) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return chunkSize;
      })
    );
    const gained = results.reduce((sum, r) => (r.status === "fulfilled" ? sum + r.value : sum), 0);
    if (gained === 0) {
      const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed) lastError = failed.reason;
      break;
    }
    totalBytes += gained;
    if (onProgress) {
      const seconds = (Date.now() - start) / 1000;
      onProgress({ mbps: (totalBytes * 8) / seconds / 1_000_000, bytes: totalBytes, seconds });
    }
  }

  if (totalBytes === 0) {
    throw lastError instanceof Error ? lastError : new Error("No data accepted.");
  }

  const seconds = Math.max((Date.now() - start) / 1000, 0.001);
  const mbps = (totalBytes * 8) / seconds / 1_000_000;
  return { mbps, bytes: totalBytes, seconds };
}

function extractHost(target: string): string {
  if (target.includes("://")) {
    try {
      return new URL(target).hostname;
    } catch {
      return target;
    }
  }
  return target;
}

function toDownloadableUrl(target: string): string {
  return target.includes("://") ? target : `http://${target}/`;
}

export type SpeedTestCategory = "nepal" | "international" | "local-ip";

export async function saveSpeedTestResult(result: {
  category: SpeedTestCategory;
  target: string;
  pingMs: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
}): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("category", sql.NVarChar, result.category)
    .input("target", sql.NVarChar, result.target)
    .input("pingMs", sql.Decimal(10, 2), result.pingMs)
    .input("downloadMbps", sql.Decimal(10, 2), result.downloadMbps)
    .input("uploadMbps", sql.Decimal(10, 2), result.uploadMbps)
    .query(
      `INSERT INTO SpeedTestResults (Category, Target, PingMs, DownloadMbps, UploadMbps) VALUES (@category, @target, @pingMs, @downloadMbps, @uploadMbps)`
    );
}

export async function runSpeedTestStreaming(
  rawTarget: string,
  category: SpeedTestCategory,
  onEvent: (e: ProgressEvent) => void
): Promise<void> {
  // A known preset carries its own download/upload URL pair (the Ookla-mini protocol needs two
  // different paths); a custom target (Local IP, or any free-typed URL) isn't a known quantity,
  // so we fall back to trying the same URL for both directions.
  const preset = findPreset(rawTarget);
  const downloadUrl = preset ? preset.downloadUrl : toDownloadableUrl(rawTarget);
  const uploadUrl = preset ? preset.uploadUrl : toDownloadableUrl(rawTarget);
  const pingHost = extractHost(preset ? preset.downloadUrl : rawTarget);

  let pingMs: number | null = null;
  let downloadMbps: number | null = null;
  let uploadMbps: number | null = null;

  onEvent({ phase: "ping", status: "running" });
  try {
    const pingOutput = await runPing(pingHost);
    const s = parsePingSummary(pingOutput);
    onEvent({ phase: "ping", status: "done", avgMs: s.avg, minMs: s.min, maxMs: s.max, lossPct: s.lossPct });
    const parsed = parseFloat(s.avg);
    pingMs = Number.isNaN(parsed) ? null : parsed;
  } catch (err) {
    onEvent({ phase: "ping", status: "failed", error: err instanceof Error ? err.message : String(err) });
  }

  try {
    const dl = await measureDownload(downloadUrl, 20_000_000, 10, (p) =>
      onEvent({ phase: "download", status: "running", ...p })
    );
    onEvent({ phase: "download", status: "done", ...dl });
    downloadMbps = dl.mbps;
  } catch (err) {
    onEvent({ phase: "download", status: "failed", error: err instanceof Error ? err.message : String(err) });
  }

  try {
    const ul = await measureUpload(uploadUrl, 8_000_000, 10, (p) => onEvent({ phase: "upload", status: "running", ...p }));
    onEvent({ phase: "upload", status: "done", ...ul });
    uploadMbps = ul.mbps;
  } catch (err) {
    onEvent({ phase: "upload", status: "failed", error: err instanceof Error ? err.message : String(err) });
  }

  try {
    await saveSpeedTestResult({ category, target: rawTarget, pingMs, downloadMbps, uploadMbps });
  } catch {
    // Persisting history is a nice-to-have — never let a DB hiccup break the actual test result.
  }
}
