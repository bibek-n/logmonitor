import { sql } from "../db";
import type { FilterParam } from "../qaShared";

// Shared row types and constants for the Website Speed & Performance module. Same reason
// qaShared.ts exists: route.ts files may only export HTTP method handlers (a Next.js App
// Router build-time rule, not caught by tsc alone), so anything shared between route files
// lives here instead.

export interface WebsitePerformanceConfigRow {
  Id: number;
  WebsiteId: number;
  Enabled: boolean;
  TestDevice: string;
  ScheduleType: string;
  CustomCron: string | null;
  TimeoutSeconds: number;
  ScreenshotCapture: boolean;
  ScoreThreshold: number | null;
  LcpThresholdMs: number | null;
  ClsThreshold: number | null;
  TbtThresholdMs: number | null;
  PageSizeThresholdKb: number | null;
  RequestCountThreshold: number | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface WebsitePerformanceScanRow {
  Id: number;
  WebsiteId: number;
  Device: string;
  Status: string;
  TriggeredBy: string;
  TriggeredByUserId: number | null;
  StartedAt: string | null;
  CompletedAt: string | null;
  ErrorMessage: string | null;
  FinalUrl: string | null;
  HttpStatusCode: number | null;
  RedirectCount: number | null;
  ResponseSizeBytes: number | null;
  HttpProtocol: string | null;
  ServerIp: string | null;
  DnsLookupMs: number | null;
  TcpConnectMs: number | null;
  TlsHandshakeMs: number | null;
  ContentDownloadMs: number | null;
  TotalResponseTimeMs: number | null;
  TtfbMs: number | null;
  FirstContentfulPaintMs: number | null;
  LargestContentfulPaintMs: number | null;
  CumulativeLayoutShift: number | null;
  TotalBlockingTimeMs: number | null;
  SpeedIndexMs: number | null;
  TimeToInteractiveMs: number | null;
  InteractionToNextPaintMs: number | null;
  DomContentLoadedMs: number | null;
  FullyLoadedMs: number | null;
  FirstPaintMs: number | null;
  OverallScore: number | null;
  CoreWebVitalsScore: number | null;
  ServerResponseScore: number | null;
  ResourceOptimizationScore: number | null;
  UserExperienceScore: number | null;
  ScreenshotPath: string | null;
  CreatedAt: string;
}

export interface WebsitePerformanceResourceMetricsRow {
  Id: number;
  ScanId: number;
  TotalRequests: number | null;
  TotalTransferredBytes: number | null;
  TotalUncompressedBytes: number | null;
  HtmlCount: number | null;
  HtmlBytes: number | null;
  CssCount: number | null;
  CssBytes: number | null;
  JsCount: number | null;
  JsBytes: number | null;
  ImageCount: number | null;
  ImageBytes: number | null;
  FontCount: number | null;
  FontBytes: number | null;
  MediaCount: number | null;
  MediaBytes: number | null;
  ThirdPartyCount: number | null;
  ThirdPartyBytes: number | null;
  CachedCount: number | null;
  FailedCount: number | null;
  RedirectedCount: number | null;
  RenderBlockingCount: number | null;
  UnusedCssBytesEst: number | null;
  UnusedJsBytesEst: number | null;
  UnoptimizedImageCount: number | null;
}

export interface WebsiteOptimizationCheckRow {
  Id: number;
  ScanId: number;
  CheckKey: string;
  CheckName: string;
  Status: string;
  Severity: string;
  CurrentValueText: string | null;
  RecommendedValueText: string | null;
  Description: string | null;
  Recommendation: string | null;
  EstimatedSavingsMs: number | null;
  EstimatedSavingsBytes: number | null;
  AffectedResourceCount: number | null;
}

export interface WebsitePerformanceAlertRow {
  Id: number;
  WebsiteId: number;
  ScanId: number | null;
  AlertType: string;
  Severity: string;
  Detail: string;
  TriggeredAt: string;
  ResolvedAt: string | null;
}

export interface WebsitePerformanceListRow {
  Id: number;
  Name: string;
  Url: string;
  Enabled: boolean;
  PerfEnabled: boolean;
  TestDevice: string | null;
  LatestScore: number | null;
  LatestStatus: string | null;
  LatestScanStatus: string | null;
  LatestTestedAt: string | null;
  LatestAuditScore: number | null;
  LatestAuditRiskLevel: string | null;
}

export const VALID_TEST_DEVICES = new Set(["Mobile", "Desktop", "Both"]);
export const VALID_SCHEDULE_TYPES = new Set([
  "Every15Min",
  "Every30Min",
  "Hourly",
  "Every6Hours",
  "Every12Hours",
  "Daily",
  "Custom",
]);
export const VALID_SCAN_DEVICES = new Set(["Mobile", "Desktop"]);
export const VALID_SCAN_STATUSES = new Set(["Pending", "Running", "Completed", "Failed"]);
export const VALID_PERFORMANCE_STATUSES = new Set(["Excellent", "Good", "NeedsImprovement", "Poor", "NotTested"]);
export const VALID_CHECK_STATUSES = new Set(["Pass", "Fail", "Warning", "NotApplicable"]);
export const VALID_SEVERITIES = new Set(["Critical", "High", "Medium", "Low", "Info"]);

// 90-100 Excellent / 75-89 Good / 50-74 Needs Improvement / 0-49 Poor - matches the request's
// suggested labels exactly.
export function performanceStatusFor(score: number | null): string {
  if (score === null) return "NotTested";
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "NeedsImprovement";
  return "Poor";
}

export function buildWebsitePerformanceListFilters(sp: URLSearchParams): {
  conditions: string[];
  params: FilterParam[];
  error?: string;
} {
  const conditions: string[] = [];
  const params: FilterParam[] = [];

  const search = sp.get("search");
  if (search && search.trim()) {
    params.push({ name: "search", type: sql.NVarChar, value: `%${search.trim().slice(0, 200)}%` });
    conditions.push("(w.Name LIKE @search OR w.Url LIKE @search)");
  }

  const speedStatus = sp.get("speedStatus");
  if (speedStatus) {
    if (!VALID_PERFORMANCE_STATUSES.has(speedStatus)) return { conditions, params, error: "Invalid speedStatus filter." };
    params.push({ name: "speedStatus", type: sql.VarChar, value: speedStatus });
    if (speedStatus === "NotTested") {
      conditions.push("latest.OverallScore IS NULL");
    } else {
      conditions.push(
        `latest.OverallScore IS NOT NULL AND (
          (@speedStatus = 'Excellent' AND latest.OverallScore >= 90) OR
          (@speedStatus = 'Good' AND latest.OverallScore >= 75 AND latest.OverallScore < 90) OR
          (@speedStatus = 'NeedsImprovement' AND latest.OverallScore >= 50 AND latest.OverallScore < 75) OR
          (@speedStatus = 'Poor' AND latest.OverallScore < 50)
        )`
      );
    }
  }

  const monitoring = sp.get("monitoring");
  if (monitoring === "enabled") conditions.push("cfg.Enabled = 1");
  else if (monitoring === "disabled") conditions.push("(cfg.Enabled = 0 OR cfg.Enabled IS NULL)");

  return { conditions, params };
}
