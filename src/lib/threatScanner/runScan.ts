import { getDb, sql } from "../db";
import {
  submitFileForScan, submitUrlForScan, getAnalysis, getFileReport, getUrlReport, getIpReport, getDomainReport,
  urlToVtId, verdictFromStats, VtNotFoundError, type VtStats,
} from "./virustotal";
import type { ThreatScanKind } from "./shared";

// VT's free tier is rate-limited to 4 requests/minute - polling any faster risks 429s on the
// very requests that are supposed to report progress. 15s between polls, capped at 8 polls
// (~2 minutes total), comfortably covers VT's typical analysis time for both files and URLs
// while staying well under that limit even with the submit + final-report calls included.
const POLL_INTERVAL_MS = 15_000;
const MAX_POLLS = 8;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateStatsInFlight(scanId: number, stats: VtStats): Promise<void> {
  await getDb().then((db) =>
    db
      .request()
      .input("id", sql.Int, scanId)
      .input("malicious", sql.Int, stats.malicious)
      .input("suspicious", sql.Int, stats.suspicious)
      .input("harmless", sql.Int, stats.harmless)
      .input("undetected", sql.Int, stats.undetected)
      .input("timeout", sql.Int, stats.timeout)
      .query(
        `UPDATE ThreatScans SET Status = 'Running', MaliciousCount = @malicious, SuspiciousCount = @suspicious,
           HarmlessCount = @harmless, UndetectedCount = @undetected, TimeoutCount = @timeout WHERE Id = @id`
      )
  );
}

// Waits for VT's own async analysis to finish, polling at a rate-limit-safe interval and
// pushing partial engine counts into the scan row on every poll so the client's status-polling
// UI can show live-ticking numbers even before the analysis completes (same idea as the
// elapsed-time indicator built for the Website Performance module's synchronous scans).
async function waitForAnalysis(analysisId: string): Promise<{ resourceId: string | null; stats: VtStats }> {
  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    const analysis = await getAnalysis(analysisId);
    if (analysis.status === "completed") return { resourceId: analysis.resourceId, stats: analysis.stats };
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("Timed out waiting for VirusTotal to finish analyzing this submission.");
}

interface CreateRowOptions {
  kind: ThreatScanKind;
  target: string;
  websiteId?: number | null;
  originalFileName?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  filePath?: string | null;
  triggeredByUserId: number;
  triggeredByUsername: string;
}

export async function createScanRow(opts: CreateRowOptions): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("kind", sql.VarChar, opts.kind)
    .input("target", sql.NVarChar, opts.target)
    .input("websiteId", sql.Int, opts.websiteId ?? null)
    .input("originalFileName", sql.NVarChar, opts.originalFileName ?? null)
    .input("contentType", sql.NVarChar, opts.contentType ?? null)
    .input("sizeBytes", sql.BigInt, opts.sizeBytes ?? null)
    .input("filePath", sql.NVarChar, opts.filePath ?? null)
    .input("triggeredByUserId", sql.Int, opts.triggeredByUserId)
    .input("triggeredByUsername", sql.NVarChar, opts.triggeredByUsername)
    .query<{ Id: number }>(`
      INSERT INTO ThreatScans (Kind, Target, WebsiteId, Status, OriginalFileName, ContentType, SizeBytes, FilePath,
        TriggeredByUserId, TriggeredByUsername, StartedAt)
      OUTPUT INSERTED.Id
      VALUES (@kind, @target, @websiteId, 'Running', @originalFileName, @contentType, @sizeBytes, @filePath,
        @triggeredByUserId, @triggeredByUsername, SYSUTCDATETIME())
    `);
  return result.recordset[0].Id;
}

async function markFailed(scanId: number, message: string): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, scanId)
    .input("error", sql.NVarChar, message.slice(0, 990))
    .query("UPDATE ThreatScans SET Status = 'Failed', CompletedAt = SYSUTCDATETIME(), ErrorMessage = @error WHERE Id = @id");
}

async function markCompleted(
  scanId: number,
  vtAnalysisId: string,
  vtResourceId: string | null,
  report: { stats: VtStats; engineCount: number; engines: { engineName: string; category: string; result: string | null }[] }
): Promise<void> {
  const db = await getDb();
  const verdict = verdictFromStats(report.stats);
  await db
    .request()
    .input("id", sql.Int, scanId)
    .input("vtAnalysisId", sql.NVarChar, vtAnalysisId)
    .input("vtResourceId", sql.NVarChar, vtResourceId)
    .input("verdict", sql.VarChar, verdict)
    .input("malicious", sql.Int, report.stats.malicious)
    .input("suspicious", sql.Int, report.stats.suspicious)
    .input("harmless", sql.Int, report.stats.harmless)
    .input("undetected", sql.Int, report.stats.undetected)
    .input("timeout", sql.Int, report.stats.timeout)
    .input("engineCount", sql.Int, report.engineCount)
    .input("resultJson", sql.NVarChar, JSON.stringify(report.engines))
    .query(`
      UPDATE ThreatScans SET
        Status = 'Completed', CompletedAt = SYSUTCDATETIME(), VtAnalysisId = @vtAnalysisId, VtResourceId = @vtResourceId,
        Verdict = @verdict, MaliciousCount = @malicious, SuspiciousCount = @suspicious, HarmlessCount = @harmless,
        UndetectedCount = @undetected, TimeoutCount = @timeout, EngineCount = @engineCount, ResultJson = @resultJson
      WHERE Id = @id
    `);
}

export async function runFileScan(scanId: number, buffer: Buffer, filename: string): Promise<void> {
  try {
    const { analysisId } = await submitFileForScan(buffer, filename);
    const { resourceId, stats } = await waitForAnalysis(analysisId);
    await updateStatsInFlight(scanId, stats);
    if (!resourceId) throw new Error("VirusTotal did not return a file identifier after analysis completed.");
    const report = await getFileReport(resourceId);
    await markCompleted(scanId, analysisId, resourceId, report);
  } catch (err) {
    await markFailed(scanId, err instanceof Error ? err.message : "Unknown error running the file scan.");
    throw err;
  }
}

export async function runUrlScan(scanId: number, url: string): Promise<void> {
  try {
    const { analysisId } = await submitUrlForScan(url);
    const { stats } = await waitForAnalysis(analysisId);
    await updateStatsInFlight(scanId, stats);
    const vtUrlId = urlToVtId(url);
    const report = await getUrlReport(vtUrlId);
    await markCompleted(scanId, analysisId, vtUrlId, report);
  } catch (err) {
    await markFailed(scanId, err instanceof Error ? err.message : "Unknown error running the URL scan.");
    throw err;
  }
}

export interface LookupOptions {
  kind: "Hash" | "Ip" | "Domain";
  value: string;
  triggeredByUserId: number;
  triggeredByUsername: string;
}

// Hash/IP/domain lookups read VT's existing report directly - no submission, no polling, so
// this runs synchronously inside the request instead of the fire-and-forget pattern the
// File/URL scans use.
export async function runLookup(opts: LookupOptions): Promise<number> {
  const db = await getDb();
  const insertResult = await db
    .request()
    .input("kind", sql.VarChar, opts.kind)
    .input("target", sql.NVarChar, opts.value)
    .input("triggeredByUserId", sql.Int, opts.triggeredByUserId)
    .input("triggeredByUsername", sql.NVarChar, opts.triggeredByUsername)
    .query<{ Id: number }>(`
      INSERT INTO ThreatScans (Kind, Target, Status, TriggeredByUserId, TriggeredByUsername, StartedAt)
      OUTPUT INSERTED.Id
      VALUES (@kind, @target, 'Running', @triggeredByUserId, @triggeredByUsername, SYSUTCDATETIME())
    `);
  const scanId = insertResult.recordset[0].Id;

  try {
    const report =
      opts.kind === "Hash" ? await getFileReport(opts.value) : opts.kind === "Ip" ? await getIpReport(opts.value) : await getDomainReport(opts.value);
    await markCompleted(scanId, "", opts.kind === "Hash" ? opts.value : null, report);
  } catch (err) {
    if (err instanceof VtNotFoundError) {
      await db.request().input("id", sql.Int, scanId).query(
        "UPDATE ThreatScans SET Status = 'NotFound', CompletedAt = SYSUTCDATETIME() WHERE Id = @id"
      );
    } else {
      await markFailed(scanId, err instanceof Error ? err.message : "Unknown error running the lookup.");
    }
  }

  return scanId;
}
