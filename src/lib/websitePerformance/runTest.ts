import { getDb, sql } from "../db";
import { sendNotificationEmail } from "../notifyEmail";
import { measureConnectionTiming, ConnectionTimingError } from "./connectionTiming";
import { runPageSpeedTest } from "./pagespeed";
import { computeSubScores } from "./scoring";
import { performanceStatusFor, type WebsitePerformanceConfigRow } from "./shared";

// Same default recipient list already used by websiteSecurityAudit/emailReport.ts - one
// notification system, not a second one, per the spec's explicit instruction.
const DEFAULT_RECIPIENTS = "bibek@tulipstechnologies.com, support@websearchpro.net";
const RECIPIENTS = process.env.WEBSITE_PERFORMANCE_ALERT_RECIPIENTS || DEFAULT_RECIPIENTS;

export interface RunTestOptions {
  websiteId: number;
  devices?: ("Mobile" | "Desktop")[]; // explicit override; falls back to the website's config
  triggeredBy: "Manual" | "Scheduled";
  triggeredByUserId?: number | null;
}

export interface RunTestResult {
  device: string;
  scanId: number;
  status: "Completed" | "Failed";
  overallScore: number | null;
  errorMessage?: string;
}

async function devicesToRun(websiteId: number, requested: ("Mobile" | "Desktop")[] | undefined): Promise<("Mobile" | "Desktop")[]> {
  if (requested && requested.length > 0) return requested;
  const db = await getDb();
  const cfg = await db.request().input("id", sql.Int, websiteId).query<WebsitePerformanceConfigRow>(
    "SELECT * FROM WebsitePerformanceConfigs WHERE WebsiteId = @id"
  );
  const testDevice = cfg.recordset[0]?.TestDevice ?? "Both";
  if (testDevice === "Mobile") return ["Mobile"];
  if (testDevice === "Desktop") return ["Desktop"];
  return ["Mobile", "Desktop"];
}

async function hasInFlightScan(websiteId: number, device: string): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .input("device", sql.VarChar, device)
    .query<{ Cnt: number }>(
      "SELECT COUNT(*) AS Cnt FROM WebsitePerformanceScans WHERE WebsiteId = @websiteId AND Device = @device AND Status IN ('Pending', 'Running')"
    );
  return (result.recordset[0]?.Cnt ?? 0) > 0;
}

async function evaluateAlerts(websiteId: number, scanId: number, device: string, cfg: WebsitePerformanceConfigRow | null, metrics: {
  overallScore: number | null;
  largestContentfulPaintMs: number | null;
  cumulativeLayoutShift: number | null;
  totalBlockingTimeMs: number | null;
  totalTransferredBytes: number | null;
  totalRequests: number | null;
}): Promise<string[]> {
  const db = await getDb();
  const newAlerts: { type: string; severity: string; detail: string }[] = [];

  function check(condition: boolean, type: string, severity: string, detail: string) {
    if (condition) newAlerts.push({ type, severity, detail });
  }

  if (cfg?.ScoreThreshold != null && metrics.overallScore != null) {
    check(metrics.overallScore < cfg.ScoreThreshold, "ScoreBelowThreshold", "warning", `${device} performance score ${metrics.overallScore} is below the ${cfg.ScoreThreshold} threshold.`);
  }
  if (cfg?.LcpThresholdMs != null && metrics.largestContentfulPaintMs != null) {
    check(metrics.largestContentfulPaintMs > cfg.LcpThresholdMs, "LcpAboveThreshold", "warning", `${device} Largest Contentful Paint ${metrics.largestContentfulPaintMs}ms exceeds the ${cfg.LcpThresholdMs}ms threshold.`);
  }
  if (cfg?.ClsThreshold != null && metrics.cumulativeLayoutShift != null) {
    check(metrics.cumulativeLayoutShift > cfg.ClsThreshold, "ClsAboveThreshold", "warning", `${device} Cumulative Layout Shift ${metrics.cumulativeLayoutShift.toFixed(3)} exceeds the ${cfg.ClsThreshold} threshold.`);
  }
  if (cfg?.TbtThresholdMs != null && metrics.totalBlockingTimeMs != null) {
    check(metrics.totalBlockingTimeMs > cfg.TbtThresholdMs, "TbtAboveThreshold", "warning", `${device} Total Blocking Time ${metrics.totalBlockingTimeMs}ms exceeds the ${cfg.TbtThresholdMs}ms threshold.`);
  }
  if (cfg?.PageSizeThresholdKb != null && metrics.totalTransferredBytes != null) {
    const kb = Math.round(metrics.totalTransferredBytes / 1024);
    check(kb > cfg.PageSizeThresholdKb, "PageSizeAboveThreshold", "info", `${device} page size ${kb}KB exceeds the ${cfg.PageSizeThresholdKb}KB threshold.`);
  }
  if (cfg?.RequestCountThreshold != null && metrics.totalRequests != null) {
    check(metrics.totalRequests > cfg.RequestCountThreshold, "RequestCountAboveThreshold", "info", `${device} request count ${metrics.totalRequests} exceeds the ${cfg.RequestCountThreshold} threshold.`);
  }

  // Auto-resolve any previously open alert type that isn't breaching anymore - this is what
  // makes "Performance recovery detected" observable without a separate alert type: the alert
  // simply stops appearing as unresolved.
  const stillBreachingTypes = new Set(newAlerts.map((a) => a.type));
  const openAlerts = await db.request().input("websiteId", sql.Int, websiteId).query<{ Id: number; AlertType: string }>(
    "SELECT Id, AlertType FROM WebsitePerformanceAlerts WHERE WebsiteId = @websiteId AND ResolvedAt IS NULL"
  );
  for (const row of openAlerts.recordset) {
    if (!stillBreachingTypes.has(row.AlertType)) {
      await db.request().input("id", sql.Int, row.Id).query("UPDATE WebsitePerformanceAlerts SET ResolvedAt = SYSUTCDATETIME() WHERE Id = @id");
    }
  }

  const emailLines: string[] = [];
  for (const alert of newAlerts) {
    // Don't re-insert/re-notify an alert type that's already open for this website.
    const existing = await db
      .request()
      .input("websiteId", sql.Int, websiteId)
      .input("type", sql.VarChar, alert.type)
      .query<{ Id: number }>("SELECT Id FROM WebsitePerformanceAlerts WHERE WebsiteId = @websiteId AND AlertType = @type AND ResolvedAt IS NULL");
    if (existing.recordset[0]) continue;

    await db
      .request()
      .input("websiteId", sql.Int, websiteId)
      .input("scanId", sql.Int, scanId)
      .input("type", sql.VarChar, alert.type)
      .input("severity", sql.VarChar, alert.severity)
      .input("detail", sql.NVarChar, alert.detail)
      .query(
        "INSERT INTO WebsitePerformanceAlerts (WebsiteId, ScanId, AlertType, Severity, Detail) VALUES (@websiteId, @scanId, @type, @severity, @detail)"
      );
    emailLines.push(alert.detail);
  }

  return emailLines;
}

async function runOneDevice(websiteId: number, url: string, device: "Mobile" | "Desktop", opts: RunTestOptions): Promise<RunTestResult> {
  const db = await getDb();

  const insertResult = await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .input("device", sql.VarChar, device)
    .input("triggeredBy", sql.VarChar, opts.triggeredBy)
    .input("triggeredByUserId", sql.Int, opts.triggeredByUserId ?? null)
    .query<{ Id: number }>(
      `INSERT INTO WebsitePerformanceScans (WebsiteId, Device, Status, TriggeredBy, TriggeredByUserId, StartedAt)
       OUTPUT INSERTED.Id
       VALUES (@websiteId, @device, 'Running', @triggeredBy, @triggeredByUserId, SYSUTCDATETIME())`
    );
  const scanId = insertResult.recordset[0].Id;

  try {
    const cfgResult = await db.request().input("id", sql.Int, websiteId).query<WebsitePerformanceConfigRow>(
      "SELECT * FROM WebsitePerformanceConfigs WHERE WebsiteId = @id"
    );
    const cfg = cfgResult.recordset[0] ?? null;
    const timeoutSeconds = cfg?.TimeoutSeconds ?? 60;

    const [timing, psi] = await Promise.all([
      measureConnectionTiming(url, timeoutSeconds),
      runPageSpeedTest(url, device === "Mobile" ? "mobile" : "desktop", timeoutSeconds),
    ]);

    const subScores = computeSubScores({
      largestContentfulPaintMs: psi.largestContentfulPaintMs,
      cumulativeLayoutShift: psi.cumulativeLayoutShift,
      totalBlockingTimeMs: psi.totalBlockingTimeMs,
      interactionToNextPaintMs: psi.interactionToNextPaintMs,
      ttfbMs: timing.ttfbMs,
      totalResponseTimeMs: timing.totalResponseTimeMs,
      totalTransferredBytes: psi.resources.totalTransferredBytes,
      totalRequests: psi.resources.totalRequests,
      unusedCssBytesEst: psi.resources.unusedCssBytesEst,
      unusedJsBytesEst: psi.resources.unusedJsBytesEst,
      failedCount: psi.resources.failedCount,
      speedIndexMs: psi.speedIndexMs,
      timeToInteractiveMs: psi.timeToInteractiveMs,
    });

    let screenshotPath: string | null = null;
    if ((cfg?.ScreenshotCapture ?? true) && psi.screenshotDataUrl) {
      screenshotPath = await saveScreenshot(websiteId, scanId, psi.screenshotDataUrl);
    }

    await db
      .request()
      .input("id", sql.Int, scanId)
      .input("finalUrl", sql.NVarChar, timing.finalUrl)
      .input("httpStatusCode", sql.Int, timing.httpStatusCode)
      .input("redirectCount", sql.Int, timing.redirectCount)
      .input("responseSizeBytes", sql.BigInt, timing.responseSizeBytes)
      .input("httpProtocol", sql.VarChar, timing.httpProtocol)
      .input("serverIp", sql.VarChar, timing.serverIp)
      .input("dnsLookupMs", sql.Int, timing.dnsLookupMs)
      .input("tcpConnectMs", sql.Int, timing.tcpConnectMs)
      .input("tlsHandshakeMs", sql.Int, timing.tlsHandshakeMs)
      .input("contentDownloadMs", sql.Int, timing.contentDownloadMs)
      .input("totalResponseTimeMs", sql.Int, timing.totalResponseTimeMs)
      .input("ttfbMs", sql.Int, timing.ttfbMs)
      .input("fcp", sql.Int, psi.firstContentfulPaintMs)
      .input("lcp", sql.Int, psi.largestContentfulPaintMs)
      .input("cls", sql.Float, psi.cumulativeLayoutShift)
      .input("tbt", sql.Int, psi.totalBlockingTimeMs)
      .input("si", sql.Int, psi.speedIndexMs)
      .input("tti", sql.Int, psi.timeToInteractiveMs)
      .input("inp", sql.Int, psi.interactionToNextPaintMs)
      .input("dcl", sql.Int, psi.domContentLoadedMs)
      .input("fullyLoaded", sql.Int, psi.fullyLoadedMs)
      .input("firstPaint", sql.Int, psi.firstPaintMs)
      .input("overallScore", sql.Int, psi.performanceScore)
      .input("cwvScore", sql.Int, subScores.coreWebVitalsScore)
      .input("serverScore", sql.Int, subScores.serverResponseScore)
      .input("resourceScore", sql.Int, subScores.resourceOptimizationScore)
      .input("uxScore", sql.Int, subScores.userExperienceScore)
      .input("screenshotPath", sql.NVarChar, screenshotPath)
      .query(`
        UPDATE WebsitePerformanceScans SET
          Status = 'Completed', CompletedAt = SYSUTCDATETIME(),
          FinalUrl = @finalUrl, HttpStatusCode = @httpStatusCode, RedirectCount = @redirectCount,
          ResponseSizeBytes = @responseSizeBytes, HttpProtocol = @httpProtocol, ServerIp = @serverIp,
          DnsLookupMs = @dnsLookupMs, TcpConnectMs = @tcpConnectMs, TlsHandshakeMs = @tlsHandshakeMs,
          ContentDownloadMs = @contentDownloadMs, TotalResponseTimeMs = @totalResponseTimeMs,
          TtfbMs = @ttfbMs, FirstContentfulPaintMs = @fcp, LargestContentfulPaintMs = @lcp,
          CumulativeLayoutShift = @cls, TotalBlockingTimeMs = @tbt, SpeedIndexMs = @si,
          TimeToInteractiveMs = @tti, InteractionToNextPaintMs = @inp, DomContentLoadedMs = @dcl,
          FullyLoadedMs = @fullyLoaded, FirstPaintMs = @firstPaint,
          OverallScore = @overallScore, CoreWebVitalsScore = @cwvScore, ServerResponseScore = @serverScore,
          ResourceOptimizationScore = @resourceScore, UserExperienceScore = @uxScore,
          ScreenshotPath = @screenshotPath
        WHERE Id = @id
      `);

    await db
      .request()
      .input("scanId", sql.Int, scanId)
      .input("totalRequests", sql.Int, psi.resources.totalRequests)
      .input("totalTransferredBytes", sql.BigInt, psi.resources.totalTransferredBytes)
      .input("totalUncompressedBytes", sql.BigInt, psi.resources.totalUncompressedBytes)
      .input("htmlCount", sql.Int, psi.resources.htmlCount).input("htmlBytes", sql.BigInt, psi.resources.htmlBytes)
      .input("cssCount", sql.Int, psi.resources.cssCount).input("cssBytes", sql.BigInt, psi.resources.cssBytes)
      .input("jsCount", sql.Int, psi.resources.jsCount).input("jsBytes", sql.BigInt, psi.resources.jsBytes)
      .input("imageCount", sql.Int, psi.resources.imageCount).input("imageBytes", sql.BigInt, psi.resources.imageBytes)
      .input("fontCount", sql.Int, psi.resources.fontCount).input("fontBytes", sql.BigInt, psi.resources.fontBytes)
      .input("mediaCount", sql.Int, psi.resources.mediaCount).input("mediaBytes", sql.BigInt, psi.resources.mediaBytes)
      .input("thirdPartyCount", sql.Int, psi.resources.thirdPartyCount).input("thirdPartyBytes", sql.BigInt, psi.resources.thirdPartyBytes)
      .input("failedCount", sql.Int, psi.resources.failedCount)
      .input("redirectedCount", sql.Int, psi.resources.redirectedCount)
      .input("renderBlockingCount", sql.Int, psi.resources.renderBlockingCount)
      .input("unusedCssBytesEst", sql.BigInt, psi.resources.unusedCssBytesEst)
      .input("unusedJsBytesEst", sql.BigInt, psi.resources.unusedJsBytesEst)
      .input("unoptimizedImageCount", sql.Int, psi.resources.unoptimizedImageCount)
      .query(`
        INSERT INTO WebsitePerformanceResourceMetrics (
          ScanId, TotalRequests, TotalTransferredBytes, TotalUncompressedBytes,
          HtmlCount, HtmlBytes, CssCount, CssBytes, JsCount, JsBytes, ImageCount, ImageBytes,
          FontCount, FontBytes, MediaCount, MediaBytes, ThirdPartyCount, ThirdPartyBytes,
          CachedCount, FailedCount, RedirectedCount, RenderBlockingCount,
          UnusedCssBytesEst, UnusedJsBytesEst, UnoptimizedImageCount
        ) VALUES (
          @scanId, @totalRequests, @totalTransferredBytes, @totalUncompressedBytes,
          @htmlCount, @htmlBytes, @cssCount, @cssBytes, @jsCount, @jsBytes, @imageCount, @imageBytes,
          @fontCount, @fontBytes, @mediaCount, @mediaBytes, @thirdPartyCount, @thirdPartyBytes,
          NULL, @failedCount, @redirectedCount, @renderBlockingCount,
          @unusedCssBytesEst, @unusedJsBytesEst, @unoptimizedImageCount
        )
      `);

    for (const check of psi.optimizationChecks) {
      await db
        .request()
        .input("scanId", sql.Int, scanId)
        .input("checkKey", sql.VarChar, check.checkKey)
        .input("checkName", sql.NVarChar, check.checkName)
        .input("status", sql.VarChar, check.status)
        .input("severity", sql.VarChar, check.severity)
        .input("currentValueText", sql.NVarChar, check.currentValueText)
        .input("recommendedValueText", sql.NVarChar, check.recommendedValueText)
        .input("description", sql.NVarChar, check.description)
        .input("recommendation", sql.NVarChar, check.recommendation)
        .input("estimatedSavingsMs", sql.Int, check.estimatedSavingsMs)
        .input("estimatedSavingsBytes", sql.BigInt, check.estimatedSavingsBytes)
        .input("affectedResourceCount", sql.Int, check.affectedResourceCount)
        .query(`
          INSERT INTO WebsiteOptimizationChecks (
            ScanId, CheckKey, CheckName, Status, Severity, CurrentValueText, RecommendedValueText,
            Description, Recommendation, EstimatedSavingsMs, EstimatedSavingsBytes, AffectedResourceCount
          ) VALUES (
            @scanId, @checkKey, @checkName, @status, @severity, @currentValueText, @recommendedValueText,
            @description, @recommendation, @estimatedSavingsMs, @estimatedSavingsBytes, @affectedResourceCount
          )
        `);
    }

    const alertLines = await evaluateAlerts(websiteId, scanId, device, cfg, {
      overallScore: psi.performanceScore,
      largestContentfulPaintMs: psi.largestContentfulPaintMs,
      cumulativeLayoutShift: psi.cumulativeLayoutShift,
      totalBlockingTimeMs: psi.totalBlockingTimeMs,
      totalTransferredBytes: psi.resources.totalTransferredBytes,
      totalRequests: psi.resources.totalRequests,
    });
    if (alertLines.length > 0) {
      const websiteRow = await db.request().input("id", sql.Int, websiteId).query<{ Name: string; Url: string }>(
        "SELECT Name, Url FROM Websites WHERE Id = @id"
      );
      const site = websiteRow.recordset[0];
      await sendNotificationEmail({
        to: RECIPIENTS,
        subject: `Performance alert: ${site?.Name ?? url} (${device})`,
        body: `Performance monitoring detected ${alertLines.length} threshold breach(es) for ${site?.Name ?? url} (${site?.Url ?? url}):\n\n${alertLines.map((l) => `- ${l}`).join("\n")}\n\nView details in LogMonitor under Audit > Speed & Performance.`,
      });
    }

    return { device, scanId, status: "Completed", overallScore: psi.performanceScore };
  } catch (err) {
    const message = err instanceof ConnectionTimingError ? err.message : err instanceof Error ? err.message : "Unknown error";
    await db.request().input("id", sql.Int, scanId).input("error", sql.NVarChar, message.slice(0, 990)).query(
      "UPDATE WebsitePerformanceScans SET Status = 'Failed', CompletedAt = SYSUTCDATETIME(), ErrorMessage = @error WHERE Id = @id"
    );
    return { device, scanId, status: "Failed", overallScore: null, errorMessage: message };
  }
}

async function saveScreenshot(websiteId: number, scanId: number, dataUrl: string): Promise<string | null> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const match = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl);
    if (!match) return null;
    const [, ext, base64] = match;
    const dir = path.join(process.cwd(), "agent-storage", "website-performance-screenshots");
    await fs.mkdir(dir, { recursive: true });
    const filename = `${websiteId}-${scanId}.${ext}`;
    await fs.writeFile(path.join(dir, filename), Buffer.from(base64, "base64"));
    return filename;
  } catch {
    return null; // screenshot capture is best-effort, never fails the test itself
  }
}

export async function runPerformanceTest(opts: RunTestOptions): Promise<RunTestResult[]> {
  const db = await getDb();
  const websiteResult = await db.request().input("id", sql.Int, opts.websiteId).query<{ Url: string; Enabled: boolean }>(
    "SELECT Url, Enabled FROM Websites WHERE Id = @id"
  );
  const website = websiteResult.recordset[0];
  if (!website) throw new Error("Website not found.");
  if (!website.Enabled) throw new Error("Website is disabled - re-enable it in the website list before testing.");

  const devices = await devicesToRun(opts.websiteId, opts.devices);
  const results: RunTestResult[] = [];

  for (const device of devices) {
    if (await hasInFlightScan(opts.websiteId, device)) {
      results.push({ device, scanId: -1, status: "Failed", overallScore: null, errorMessage: `A ${device} test is already running for this website.` });
      continue;
    }
    results.push(await runOneDevice(opts.websiteId, website.Url, device, opts));
  }

  return results;
}

export function performanceStatusLabel(score: number | null): string {
  return performanceStatusFor(score);
}
