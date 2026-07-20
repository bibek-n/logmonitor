// VirusTotal API v3 client - this app has no local malware-scanning engine (no ClamAV, no
// sandbox, no local antivirus SDK), and building one would mean maintaining a signature
// database and an execution sandbox on the Windows/IIS host that runs this app, something
// with no existing precedent in this codebase (mirrors the reasoning in
// src/lib/websitePerformance/pagespeed.ts for using Google's cloud Lighthouse instead of a
// local headless browser). VirusTotal runs the file/URL through ~70 real antivirus engines in
// its own cloud and returns a genuine multi-engine verdict, which is the "malware scan"
// integration this feature needs without adding local scanning infra. This is the ONLY place
// in the module that talks to VirusTotal - callers get a clean, already-mapped shape.
//
// Unlike PAGESPEED_API_KEY (optional, unauthenticated calls just hit a low shared quota),
// VIRUSTOTAL_API_KEY is genuinely mandatory - VT's API rejects every request with no
// `x-apikey` header at all, so callers here throw immediately rather than attempting a call
// that can never succeed.

const VT_BASE = "https://www.virustotal.com/api/v3";
const VT_TIMEOUT_MS = 60 * 1000;

function apiKey(): string {
  const key = process.env.VIRUSTOTAL_API_KEY;
  if (!key) throw new Error("VIRUSTOTAL_API_KEY is not configured. Add it to the server's .env to enable scanning.");
  return key;
}

// Thrown specifically on a 404 - "VirusTotal has no report for this resource yet" is a valid,
// expected outcome for a hash/IP/domain lookup (distinct from a real request failure), so
// callers can catch this specifically and surface a "Not Found" result instead of an error.
export class VtNotFoundError extends Error {
  constructor() {
    super("VirusTotal has no report for this resource.");
    this.name = "VtNotFoundError";
  }
}

async function vtFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${VT_BASE}${path}`, {
    ...init,
    headers: { "x-apikey": apiKey(), ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(VT_TIMEOUT_MS),
  });
  if (res.status === 404) throw new VtNotFoundError();
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`VirusTotal request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return res;
}

export interface VtEngineResult {
  engineName: string;
  category: string; // "malicious" | "suspicious" | "harmless" | "undetected" | "timeout" | ...
  result: string | null; // e.g. "Trojan.GenericKD.12345" or null when clean
}

export interface VtStats {
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  timeout: number;
}

export interface VtReport {
  stats: VtStats;
  engineCount: number;
  engines: VtEngineResult[];
  vtLink: string;
}

function statsFrom(raw: Record<string, number> | undefined): VtStats {
  return {
    malicious: raw?.malicious ?? 0,
    suspicious: raw?.suspicious ?? 0,
    harmless: raw?.harmless ?? 0,
    undetected: raw?.undetected ?? 0,
    timeout: (raw?.timeout ?? 0) + (raw?.["confirmed-timeout"] ?? 0) + (raw?.failure ?? 0) + (raw?.["type-unsupported"] ?? 0),
  };
}

function engineResultsFrom(raw: Record<string, { category: string; result: string | null }> | undefined): VtEngineResult[] {
  if (!raw) return [];
  return Object.entries(raw)
    .map(([engineName, r]) => ({ engineName, category: r.category, result: r.result }))
    .sort((a, b) => a.engineName.localeCompare(b.engineName));
}

// VT's "id" for a URL resource is base64url(url) with the trailing `=` padding stripped -
// documented in their API reference, not guessable from the JSON responses alone.
export function urlToVtId(url: string): string {
  return Buffer.from(url, "utf8").toString("base64url").replace(/=+$/, "");
}

export async function submitUrlForScan(url: string): Promise<{ analysisId: string }> {
  const res = await vtFetch("/urls", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ url }),
  });
  const data = await res.json();
  const analysisId = data?.data?.id;
  if (typeof analysisId !== "string") throw new Error("VirusTotal did not return an analysis id for this URL.");
  return { analysisId };
}

export async function submitFileForScan(buffer: Buffer, filename: string): Promise<{ analysisId: string }> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), filename);
  const res = await vtFetch("/files", { method: "POST", body: form });
  const data = await res.json();
  const analysisId = data?.data?.id;
  if (typeof analysisId !== "string") throw new Error("VirusTotal did not return an analysis id for this file.");
  return { analysisId };
}

export interface VtAnalysisStatus {
  status: "queued" | "in-progress" | "completed";
  stats: VtStats;
  resourceId: string | null; // the underlying file/url resource id, present once the analysis references it
}

export async function getAnalysis(analysisId: string): Promise<VtAnalysisStatus> {
  const res = await vtFetch(`/analyses/${encodeURIComponent(analysisId)}`);
  const data = await res.json();
  const attrs = data?.data?.attributes ?? {};
  const resourceId: string | null = data?.meta?.url_info?.id ?? data?.meta?.file_info?.sha256 ?? null;
  return {
    status: attrs.status ?? "queued",
    stats: statsFrom(attrs.stats),
    resourceId,
  };
}

async function reportFromResource(apiPath: string, guiPath: string): Promise<VtReport> {
  const res = await vtFetch(apiPath);
  const data = await res.json();
  const attrs = data?.data?.attributes ?? {};
  const stats = statsFrom(attrs.last_analysis_stats);
  const engines = engineResultsFrom(attrs.last_analysis_results);
  return {
    stats,
    engineCount: stats.malicious + stats.suspicious + stats.harmless + stats.undetected + stats.timeout,
    engines,
    vtLink: `https://www.virustotal.com/gui/${guiPath}`,
  };
}

export async function getFileReport(hash: string): Promise<VtReport> {
  return reportFromResource(`/files/${encodeURIComponent(hash)}`, `file/${encodeURIComponent(hash)}`);
}

export async function getUrlReport(vtUrlId: string): Promise<VtReport> {
  return reportFromResource(`/urls/${encodeURIComponent(vtUrlId)}`, `url/${encodeURIComponent(vtUrlId)}`);
}

export async function getIpReport(ip: string): Promise<VtReport> {
  return reportFromResource(`/ip_addresses/${encodeURIComponent(ip)}`, `ip-address/${encodeURIComponent(ip)}`);
}

export async function getDomainReport(domain: string): Promise<VtReport> {
  return reportFromResource(`/domains/${encodeURIComponent(domain)}`, `domain/${encodeURIComponent(domain)}`);
}

export function verdictFromStats(stats: VtStats): "Malicious" | "Suspicious" | "Clean" {
  if (stats.malicious > 0) return "Malicious";
  if (stats.suspicious > 0) return "Suspicious";
  return "Clean";
}
