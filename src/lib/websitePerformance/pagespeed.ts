// Google PageSpeed Insights API v5 client - this app has no headless browser (Puppeteer/
// Playwright/Lighthouse) installed anywhere, and adding one would mean bundling a Chromium
// binary and CPU/memory isolation onto the Windows/IIS host that runs this app, something
// with no existing precedent in this codebase. PSI runs real Lighthouse in Google's cloud and
// returns genuine Core Web Vitals + the full optimization-audit catalog, which is
// architecturally the same "browser test integration" the spec asks for without adding local
// browser-automation infra. This is the ONLY place in the module that talks to PSI - callers
// get a clean, already-mapped shape.
//
// PAGESPEED_API_KEY is effectively required - verified live in production that the
// unauthenticated/no-key tier returns 429 "Quota exceeded" immediately (the anonymous quota
// this project's outbound IP shares was already exhausted). Get a free key at
// https://developers.google.com/speed/docs/insights/v5/get-started (25,000 req/day free tier).

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const PSI_TIMEOUT_MS = 90 * 1000; // Lighthouse-in-the-cloud runs routinely take 20-60s

export type PsiStrategy = "mobile" | "desktop";

export interface PsiOptimizationCheck {
  checkKey: string;
  checkName: string;
  status: "Pass" | "Fail" | "Warning" | "NotApplicable";
  severity: "Critical" | "High" | "Medium" | "Low" | "Info";
  currentValueText: string | null;
  recommendedValueText: string | null;
  description: string | null;
  recommendation: string | null;
  estimatedSavingsMs: number | null;
  estimatedSavingsBytes: number | null;
  affectedResourceCount: number | null;
}

export interface PsiResult {
  finalUrl: string;
  performanceScore: number | null; // 0-100, Lighthouse's own "Performance" category score
  firstContentfulPaintMs: number | null;
  largestContentfulPaintMs: number | null;
  cumulativeLayoutShift: number | null;
  totalBlockingTimeMs: number | null;
  speedIndexMs: number | null;
  timeToInteractiveMs: number | null;
  interactionToNextPaintMs: number | null;
  domContentLoadedMs: number | null;
  fullyLoadedMs: number | null;
  firstPaintMs: number | null;
  resources: {
    totalRequests: number;
    totalTransferredBytes: number;
    totalUncompressedBytes: number;
    htmlCount: number; htmlBytes: number;
    cssCount: number; cssBytes: number;
    jsCount: number; jsBytes: number;
    imageCount: number; imageBytes: number;
    fontCount: number; fontBytes: number;
    mediaCount: number; mediaBytes: number;
    thirdPartyCount: number; thirdPartyBytes: number;
    failedCount: number;
    redirectedCount: number;
    renderBlockingCount: number;
    unusedCssBytesEst: number;
    unusedJsBytesEst: number;
    unoptimizedImageCount: number;
  };
  optimizationChecks: PsiOptimizationCheck[];
  screenshotDataUrl: string | null;
}

// Curated subset of Lighthouse's audit catalog, mapped 1:1 to the spec's "Performance
// Optimization Checks" list. Not every Lighthouse audit is surfaced - only the ones with a
// direct match in the request, so every row shown to the user maps to something they asked for.
const AUDIT_CATALOG: { key: string; name: string; severity: PsiOptimizationCheck["severity"] }[] = [
  { key: "uses-optimized-images", name: "Image compression", severity: "Medium" },
  { key: "modern-image-formats", name: "Modern image formats", severity: "Medium" },
  { key: "uses-responsive-images", name: "Responsive images", severity: "Medium" },
  { key: "offscreen-images", name: "Lazy-loaded images", severity: "Low" },
  { key: "unminified-css", name: "Minified CSS", severity: "Low" },
  { key: "unminified-javascript", name: "Minified JavaScript", severity: "Medium" },
  { key: "unused-css-rules", name: "Unused CSS", severity: "Medium" },
  { key: "unused-javascript", name: "Unused JavaScript", severity: "High" },
  { key: "render-blocking-resources", name: "Render-blocking resources", severity: "High" },
  { key: "uses-long-cache-ttl", name: "Browser caching", severity: "Medium" },
  { key: "uses-text-compression", name: "Gzip or Brotli compression", severity: "High" },
  { key: "uses-rel-preload", name: "Preload usage", severity: "Low" },
  { key: "uses-rel-preconnect", name: "Preconnect usage", severity: "Low" },
  { key: "dom-size", name: "Excessive DOM size", severity: "Medium" },
  { key: "bootup-time", name: "Long-running JavaScript tasks", severity: "High" },
  { key: "layout-shift-elements", name: "Large layout shifts", severity: "High" },
  { key: "third-party-summary", name: "Slow third-party scripts", severity: "Medium" },
  { key: "network-requests", name: "Too many network requests", severity: "Low" },
  { key: "total-byte-weight", name: "Large page size", severity: "High" },
  { key: "font-display", name: "Excessive font loading", severity: "Low" },
  { key: "uses-http2", name: "HTTP/2 or HTTP/3 usage", severity: "Medium" },
];

interface LhAudit {
  score: number | null;
  numericValue?: number;
  displayValue?: string;
  details?: { items?: unknown[]; overallSavingsMs?: number; overallSavingsBytes?: number; type?: string };
}

function auditStatus(audit: LhAudit | undefined): PsiOptimizationCheck["status"] {
  if (!audit) return "NotApplicable";
  if (audit.score === null) return "NotApplicable";
  if (audit.score >= 0.9) return "Pass";
  if (audit.score >= 0.5) return "Warning";
  return "Fail";
}

function mapResourceType(resourceType: unknown): string {
  return typeof resourceType === "string" ? resourceType : "Other";
}

export async function runPageSpeedTest(url: string, strategy: PsiStrategy, timeoutSeconds: number): Promise<PsiResult> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  const params = new URLSearchParams({ url, strategy, category: "performance" });
  if (apiKey) params.set("key", apiKey);

  const res = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, {
    signal: AbortSignal.timeout(Math.min(PSI_TIMEOUT_MS, Math.max(30, timeoutSeconds) * 1000)),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PageSpeed Insights request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();

  const lh = data?.lighthouseResult;
  if (!lh) throw new Error("PageSpeed Insights returned no lighthouseResult.");

  const audits: Record<string, LhAudit> = lh.audits ?? {};
  const perfScoreRaw = lh.categories?.performance?.score;
  const performanceScore = typeof perfScoreRaw === "number" ? Math.round(perfScoreRaw * 100) : null;

  // The `metrics` audit bundles observed timings (DCL/Load/FirstPaint) that don't have their
  // own top-level audit id - this is the one reliable source for those three fields.
  const metricsItem = (audits["metrics"]?.details?.items?.[0] ?? {}) as Record<string, number | undefined>;

  const networkRequests = (audits["network-requests"]?.details?.items ?? []) as Array<Record<string, unknown>>;
  const finalUrl = typeof lh.finalUrl === "string" ? lh.finalUrl : url;
  const finalHost = (() => {
    try {
      return new URL(finalUrl).hostname;
    } catch {
      return "";
    }
  })();

  const resources = {
    totalRequests: networkRequests.length,
    totalTransferredBytes: 0,
    totalUncompressedBytes: 0,
    htmlCount: 0, htmlBytes: 0,
    cssCount: 0, cssBytes: 0,
    jsCount: 0, jsBytes: 0,
    imageCount: 0, imageBytes: 0,
    fontCount: 0, fontBytes: 0,
    mediaCount: 0, mediaBytes: 0,
    thirdPartyCount: 0, thirdPartyBytes: 0,
    failedCount: 0,
    redirectedCount: (audits["redirects"]?.details?.items ?? []).length,
    renderBlockingCount: (audits["render-blocking-resources"]?.details?.items ?? []).length,
    unusedCssBytesEst: audits["unused-css-rules"]?.details?.overallSavingsBytes ?? 0,
    unusedJsBytesEst: audits["unused-javascript"]?.details?.overallSavingsBytes ?? 0,
    unoptimizedImageCount: (audits["modern-image-formats"]?.details?.items ?? []).length,
  };

  for (const item of networkRequests) {
    const transferSize = Number(item.transferSize ?? 0);
    const resourceSize = Number(item.resourceSize ?? transferSize);
    const statusCode = Number(item.statusCode ?? 200);
    const resourceType = mapResourceType(item.resourceType);
    const itemUrl = typeof item.url === "string" ? item.url : "";

    resources.totalTransferredBytes += transferSize;
    resources.totalUncompressedBytes += resourceSize;
    if (statusCode === 0 || statusCode >= 400) resources.failedCount += 1;

    let host = "";
    try {
      host = new URL(itemUrl).hostname;
    } catch {
      // relative/data URLs count toward totals but not the first-party/third-party split
    }
    if (host && finalHost && host !== finalHost) {
      resources.thirdPartyCount += 1;
      resources.thirdPartyBytes += transferSize;
    }

    switch (resourceType) {
      case "Document":
        resources.htmlCount += 1;
        resources.htmlBytes += transferSize;
        break;
      case "Stylesheet":
        resources.cssCount += 1;
        resources.cssBytes += transferSize;
        break;
      case "Script":
        resources.jsCount += 1;
        resources.jsBytes += transferSize;
        break;
      case "Image":
        resources.imageCount += 1;
        resources.imageBytes += transferSize;
        break;
      case "Font":
        resources.fontCount += 1;
        resources.fontBytes += transferSize;
        break;
      case "Media":
        resources.mediaCount += 1;
        resources.mediaBytes += transferSize;
        break;
      default:
        break;
    }
  }

  const optimizationChecks: PsiOptimizationCheck[] = AUDIT_CATALOG.map(({ key, name, severity }) => {
    const audit = audits[key];
    const items = (audit?.details?.items ?? []) as unknown[];
    return {
      checkKey: key,
      checkName: name,
      status: auditStatus(audit),
      severity,
      currentValueText: audit?.displayValue ?? null,
      recommendedValueText: null,
      description: null,
      recommendation: audit && audit.score !== null && audit.score < 0.9 ? `Improve "${name}" - see Lighthouse audit "${key}" for affected resources.` : null,
      estimatedSavingsMs: audit?.details?.overallSavingsMs != null ? Math.round(audit.details.overallSavingsMs) : null,
      estimatedSavingsBytes: audit?.details?.overallSavingsBytes != null ? Math.round(audit.details.overallSavingsBytes) : null,
      affectedResourceCount: audit?.score !== null && audit?.score !== undefined && audit.score < 1 ? items.length : null,
    };
  });

  const screenshotData = audits["final-screenshot"]?.details as { data?: string } | undefined;

  return {
    finalUrl,
    performanceScore,
    firstContentfulPaintMs: numOrNull(audits["first-contentful-paint"]?.numericValue),
    largestContentfulPaintMs: numOrNull(audits["largest-contentful-paint"]?.numericValue),
    cumulativeLayoutShift: numOrNull(audits["cumulative-layout-shift"]?.numericValue),
    totalBlockingTimeMs: numOrNull(audits["total-blocking-time"]?.numericValue),
    speedIndexMs: numOrNull(audits["speed-index"]?.numericValue),
    timeToInteractiveMs: numOrNull(audits["interactive"]?.numericValue),
    interactionToNextPaintMs: numOrNull(audits["interaction-to-next-paint"]?.numericValue),
    domContentLoadedMs: numOrNull(metricsItem.observedDomContentLoaded),
    fullyLoadedMs: numOrNull(metricsItem.observedLoad),
    firstPaintMs: numOrNull(metricsItem.observedFirstPaint),
    resources,
    optimizationChecks,
    screenshotDataUrl: screenshotData?.data ?? null,
  };
}

function numOrNull(v: number | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}
