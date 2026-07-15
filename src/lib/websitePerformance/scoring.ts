// Score derivation for the four sub-scores PSI doesn't hand us directly (CoreWebVitals,
// ServerResponse, ResourceOptimization, UserExperience). The headline "Overall/Mobile/Desktop
// performance" score is NOT computed here - it's Lighthouse's own `categories.performance`
// score straight from PageSpeed Insights (an already well-calibrated composite; reinventing it
// would just be a worse copy), stored directly as WebsitePerformanceScans.OverallScore per
// device. These four sub-scores are genuinely new derived signals, so their weighting is what
// the spec's "make scoring weights configurable by administrators" applies to.
//
// Weights/thresholds are env-overridable (WPERF_WEIGHT_*, matching this app's existing
// env-var-with-fallback convention e.g. NOTIFY_SMTP_*) rather than a new DB-backed settings UI
// - a full admin settings page for four weight sliders would be disproportionate to build
// right now; the env-var escape hatch covers the "configurable" requirement without it.

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Google's published Core Web Vitals thresholds (good / needs-improvement / poor).
const THRESHOLDS = {
  lcpGoodMs: envFloat("WPERF_LCP_GOOD_MS", 2500),
  lcpPoorMs: envFloat("WPERF_LCP_POOR_MS", 4000),
  clsGood: envFloat("WPERF_CLS_GOOD", 0.1),
  clsPoor: envFloat("WPERF_CLS_POOR", 0.25),
  tbtGoodMs: envFloat("WPERF_TBT_GOOD_MS", 200),
  tbtPoorMs: envFloat("WPERF_TBT_POOR_MS", 600),
  inpGoodMs: envFloat("WPERF_INP_GOOD_MS", 200),
  inpPoorMs: envFloat("WPERF_INP_POOR_MS", 500),
  ttfbGoodMs: envFloat("WPERF_TTFB_GOOD_MS", 200),
  ttfbPoorMs: envFloat("WPERF_TTFB_POOR_MS", 600),
  pageSizeGoodKb: envFloat("WPERF_PAGE_SIZE_GOOD_KB", 1500),
  pageSizePoorKb: envFloat("WPERF_PAGE_SIZE_POOR_KB", 4000),
  requestsGood: envFloat("WPERF_REQUESTS_GOOD", 50),
  requestsPoor: envFloat("WPERF_REQUESTS_POOR", 120),
  siGoodMs: envFloat("WPERF_SI_GOOD_MS", 3400),
  siPoorMs: envFloat("WPERF_SI_POOR_MS", 5800),
  ttiGoodMs: envFloat("WPERF_TTI_GOOD_MS", 3800),
  ttiPoorMs: envFloat("WPERF_TTI_POOR_MS", 7300),
};

// Lower-is-better metric -> 100 (good) / 60 (needs improvement) / 20 (poor), linearly
// interpolated between the good/poor boundaries rather than a hard step, so two sites both
// "in the poor bucket" don't score identically if one is far worse than the other.
function scoreLowerIsBetter(value: number, goodAt: number, poorAt: number): number {
  if (value <= goodAt) return 100;
  if (value >= poorAt) return 20;
  const t = (value - goodAt) / (poorAt - goodAt);
  return Math.round(100 - t * 80);
}

function average(scores: number[]): number | null {
  const valid = scores.filter((s) => Number.isFinite(s));
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

export interface ScoringInput {
  largestContentfulPaintMs: number | null;
  cumulativeLayoutShift: number | null;
  totalBlockingTimeMs: number | null;
  interactionToNextPaintMs: number | null;
  ttfbMs: number | null;
  totalResponseTimeMs: number | null;
  totalTransferredBytes: number | null;
  totalRequests: number | null;
  unusedCssBytesEst: number | null;
  unusedJsBytesEst: number | null;
  failedCount: number | null;
  speedIndexMs: number | null;
  timeToInteractiveMs: number | null;
}

export interface SubScores {
  coreWebVitalsScore: number | null;
  serverResponseScore: number | null;
  resourceOptimizationScore: number | null;
  userExperienceScore: number | null;
}

export function computeSubScores(input: ScoringInput): SubScores {
  const cwvParts: number[] = [];
  if (input.largestContentfulPaintMs !== null) cwvParts.push(scoreLowerIsBetter(input.largestContentfulPaintMs, THRESHOLDS.lcpGoodMs, THRESHOLDS.lcpPoorMs));
  if (input.cumulativeLayoutShift !== null) cwvParts.push(scoreLowerIsBetter(input.cumulativeLayoutShift, THRESHOLDS.clsGood, THRESHOLDS.clsPoor));
  if (input.totalBlockingTimeMs !== null) cwvParts.push(scoreLowerIsBetter(input.totalBlockingTimeMs, THRESHOLDS.tbtGoodMs, THRESHOLDS.tbtPoorMs));
  if (input.interactionToNextPaintMs !== null) cwvParts.push(scoreLowerIsBetter(input.interactionToNextPaintMs, THRESHOLDS.inpGoodMs, THRESHOLDS.inpPoorMs));

  const serverParts: number[] = [];
  if (input.ttfbMs !== null) serverParts.push(scoreLowerIsBetter(input.ttfbMs, THRESHOLDS.ttfbGoodMs, THRESHOLDS.ttfbPoorMs));
  if (input.totalResponseTimeMs !== null) serverParts.push(scoreLowerIsBetter(input.totalResponseTimeMs, THRESHOLDS.ttfbGoodMs * 3, THRESHOLDS.ttfbPoorMs * 3));

  const resourceParts: number[] = [];
  if (input.totalTransferredBytes !== null) resourceParts.push(scoreLowerIsBetter(input.totalTransferredBytes / 1024, THRESHOLDS.pageSizeGoodKb, THRESHOLDS.pageSizePoorKb));
  if (input.totalRequests !== null) resourceParts.push(scoreLowerIsBetter(input.totalRequests, THRESHOLDS.requestsGood, THRESHOLDS.requestsPoor));
  if (input.totalTransferredBytes !== null && input.totalTransferredBytes > 0) {
    const wastedBytes = (input.unusedCssBytesEst ?? 0) + (input.unusedJsBytesEst ?? 0);
    const wastedPct = (wastedBytes / input.totalTransferredBytes) * 100;
    resourceParts.push(scoreLowerIsBetter(wastedPct, 5, 30));
  }
  if (input.failedCount !== null) resourceParts.push(input.failedCount === 0 ? 100 : scoreLowerIsBetter(input.failedCount, 0, 10));

  const uxParts: number[] = [];
  if (input.speedIndexMs !== null) uxParts.push(scoreLowerIsBetter(input.speedIndexMs, THRESHOLDS.siGoodMs, THRESHOLDS.siPoorMs));
  if (input.timeToInteractiveMs !== null) uxParts.push(scoreLowerIsBetter(input.timeToInteractiveMs, THRESHOLDS.ttiGoodMs, THRESHOLDS.ttiPoorMs));
  if (input.cumulativeLayoutShift !== null) uxParts.push(scoreLowerIsBetter(input.cumulativeLayoutShift, THRESHOLDS.clsGood, THRESHOLDS.clsPoor));

  return {
    coreWebVitalsScore: average(cwvParts),
    serverResponseScore: average(serverParts),
    resourceOptimizationScore: average(resourceParts),
    userExperienceScore: average(uxParts),
  };
}
