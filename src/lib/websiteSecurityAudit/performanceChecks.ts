import tls from "tls";
import type { Finding } from "./types";

const UA = "LogMonitor-WebsiteSecurityAudit/1.0 (+authorized-scan)";

export interface PerformanceInfo {
  responseTimeMs: number;
  ttfbMs: number;
  contentEncoding: string | null;
  cacheControl: string | null;
  http2Supported: boolean | null;
  http3Advertised: boolean;
}

// fetch()'s response promise resolves once headers arrive (before the body is read), which
// is effectively time-to-first-byte — no separate low-level HTTP client needed.
function checkAlpn(hostname: string, port: number): Promise<string | null> {
  return new Promise((resolvePromise) => {
    const socket = tls.connect(
      { host: hostname, port, servername: hostname, ALPNProtocols: ["h2", "http/1.1"], rejectUnauthorized: false, timeout: 8000 },
      () => {
        const proto = socket.alpnProtocol || null;
        socket.end();
        resolvePromise(proto);
      }
    );
    socket.on("error", () => resolvePromise(null));
    socket.on("timeout", () => {
      socket.destroy();
      resolvePromise(null);
    });
  });
}

export async function runPerformanceChecks(url: string): Promise<{ info: PerformanceInfo; findings: Finding[] }> {
  const findings: Finding[] = [];
  const u = new URL(url);

  const t0 = Date.now();
  let ttfbMs = 0;
  let responseTimeMs = 0;
  let contentEncoding: string | null = null;
  let cacheControl: string | null = null;
  let http3Advertised = false;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": UA } });
    ttfbMs = Date.now() - t0;
    contentEncoding = res.headers.get("content-encoding");
    cacheControl = res.headers.get("cache-control");
    const altSvc = res.headers.get("alt-svc");
    http3Advertised = !!altSvc && /h3/i.test(altSvc);
    await res.text();
    responseTimeMs = Date.now() - t0;
  } catch {
    // network error — leave timing/header fields at their defaults
  }

  const http2Supported = u.protocol === "https:" ? (await checkAlpn(u.hostname, u.port ? Number(u.port) : 443)) === "h2" : null;

  findings.push({
    category: "performance_summary",
    severity: "info",
    title: "Performance summary",
    description: `TTFB: ${ttfbMs}ms | Total response time: ${responseTimeMs}ms | Compression: ${contentEncoding ?? "none"} | HTTP/2: ${
      http2Supported === null ? "n/a (not https)" : http2Supported ? "yes" : "no"
    } | HTTP/3 advertised: ${http3Advertised ? "yes" : "no"} | Cache-Control: ${cacheControl ?? "(not set)"}`,
  });

  if (ttfbMs > 1000) {
    findings.push({
      category: "performance_slow_ttfb",
      severity: "low",
      title: `Slow time-to-first-byte: ${ttfbMs}ms`,
      recommendation: "Investigate server/application response time — consider caching, a CDN, or backend performance profiling.",
    });
  }
  if (!contentEncoding) {
    findings.push({
      category: "performance_no_compression",
      severity: "low",
      title: "No response compression (gzip/brotli) detected",
      recommendation: "Enable gzip or brotli compression at the web server/CDN level to reduce transfer size and load time.",
    });
  }

  const info: PerformanceInfo = { responseTimeMs, ttfbMs, contentEncoding, cacheControl, http2Supported, http3Advertised };
  return { info, findings };
}
