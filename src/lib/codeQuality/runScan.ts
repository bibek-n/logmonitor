import fs from "fs/promises";
import path from "path";
import { getDb, sql } from "@/lib/db";
import { validateSourcePath } from "@/lib/pathSecurity";
import { walkSourceFiles } from "@/lib/fileWalker";
import { syncRepo } from "@/lib/repoConnections/sync";
import type { RepoConnectionRow } from "@/lib/repoConnections/types";
import { loadEffectiveSettings, loadScanTimeoutSeconds, loadRuleSeverities, type ScanConfigOverrides } from "./settings";
import { analyzeComplexity } from "./complexity";
import { analyzeDeadCode } from "./deadCode";
import { analyzeUnusedVariables } from "./unusedVariables";
import { analyzeUnusedFunctions } from "./unusedFunctions";
import { analyzeDuplication } from "./duplication";
import { analyzeCodingStandards } from "./codingStandards";
import { calculateQualityScore } from "./qualityScore";
import type { AnalyzerIssue, AnalyzerMetric, IssueSeverity, SourceFile } from "./types";

export interface StartScanOptions {
  projectId: number;
  branch?: string | null;
  scanType?: "Full" | "Incremental";
  startedByUserId: number;
  overrides?: ScanConfigOverrides;
}

interface ProjectRow {
  Id: number;
  Name: string;
  SourcePath: string;
  DefaultBranch: string | null;
  RepoConnectionId: number | null;
  RepoProvider: "GitHub" | "GitLab" | null;
  // For a GitHub-backed project: RepositoryOwner/RepositoryName are the literal owner/repo.
  // For a GitLab-backed project: RepositoryOwner holds the numeric GitLab project id (GitLab's
  // archive/commit APIs need the id, not the path) and RepositoryName holds the human-readable
  // path_with_namespace - a deliberate repurposing of the same two columns rather than adding
  // GitLab-specific ones, since a project is only ever backed by one provider at a time. See
  // src/lib/repoConnections/sync.ts's SyncOptions for the same convention used by every module.
  RepositoryOwner: string | null;
  RepositoryName: string | null;
  RepositoryRef: string | null;
}

async function logProgress(scanId: number, message: string): Promise<void> {
  try {
    const db = await getDb();
    await db
      .request()
      .input("scanId", sql.Int, scanId)
      .input("message", sql.NVarChar, message)
      .query("INSERT INTO CodeQualityScanLog (ScanId, Message) VALUES (@scanId, @message)");
  } catch (err) {
    console.error("[codeQuality runScan] failed to write progress log line:", err instanceof Error ? err.message : err);
  }
}

async function currentStatus(scanId: number): Promise<string | null> {
  const db = await getDb();
  const result = await db.request().input("scanId", sql.Int, scanId).query<{ Status: string }>("SELECT Status FROM CodeQualityScans WHERE Id = @scanId");
  return result.recordset[0]?.Status ?? null;
}

// Creates the 'Running' scan row and returns its id immediately, before any file is read -
// the API route responds to the browser with this id right away, then executeScan() keeps
// going in the background. Mirrors websiteSecurityAudit/runScan.ts's createScanRow()/
// executeScan() split, the closest existing precedent for a long-running scan in this app.
export async function createScanRow(opts: StartScanOptions): Promise<number> {
  const db = await getDb();
  const insertResult = await db
    .request()
    .input("projectId", sql.Int, opts.projectId)
    .input("branch", sql.NVarChar, opts.branch ?? null)
    .input("scanType", sql.VarChar, opts.scanType ?? "Full")
    .input("startedByUserId", sql.Int, opts.startedByUserId)
    .input("configSnapshot", sql.NVarChar, JSON.stringify(opts.overrides ?? {}))
    .query<{ Id: number }>(`
      INSERT INTO CodeQualityScans (ProjectId, Branch, ScanType, Status, StartedByUserId, StartedAt, ConfigSnapshot)
      OUTPUT INSERTED.Id
      VALUES (@projectId, @branch, @scanType, 'Running', @startedByUserId, SYSUTCDATETIME(), @configSnapshot)
    `);
  return insertResult.recordset[0].Id;
}

async function readSourceFile(absolutePath: string, relativePath: string): Promise<SourceFile | null> {
  try {
    const buffer = await fs.readFile(absolutePath);
    // Checked as raw bytes, before utf8-decoding - a binary file masquerading under an
    // allowed extension would otherwise get silently mangled (replacement characters) by
    // the utf8 decode rather than being reliably detectable afterward. Byte value 0 is a
    // NUL byte, which never legitimately appears in a text source file.
    if (buffer.includes(0)) return null;
    const content = buffer.toString("utf8");
    return { absolutePath, relativePath, content, lines: content.split(/\r\n|\r|\n/) };
  } catch {
    return null; // unreadable (permissions, race with deletion) - skip rather than fail the scan
  }
}

// Batch reference-number assignment in a single transaction, same MAX+1-under-lock technique
// as qaReferenceNumbers.ts's withReferenceNumber - but that helper does one row per
// transaction, and a scan can produce hundreds of issues at once, so this computes the
// starting number once and increments in memory for the whole batch instead of serializing
// one transaction per issue.
async function persistIssues(scanId: number, projectId: number, issues: AnalyzerIssue[], severityOverrides: Map<string, IssueSeverity>): Promise<void> {
  if (issues.length === 0) return;
  const db = await getDb();
  const transaction = new sql.Transaction(db);
  await transaction.begin();
  try {
    const maxResult = await new sql.Request(transaction).query<{ MaxNum: number | null }>(
      "SELECT MAX(CAST(SUBSTRING(IssueNumber, 7, 10) AS INT)) AS MaxNum FROM CodeQualityIssues WITH (UPDLOCK, HOLDLOCK) WHERE IssueNumber LIKE 'ISSUE-%'"
    );
    let next = (maxResult.recordset[0]?.MaxNum ?? 0) + 1;

    for (const issue of issues) {
      const issueNumber = `ISSUE-${String(next).padStart(5, "0")}`;
      next++;
      const severity = severityOverrides.get(issue.ruleCode) ?? issue.severity;
      await new sql.Request(transaction)
        .input("issueNumber", sql.NVarChar, issueNumber)
        .input("projectId", sql.Int, projectId)
        .input("scanId", sql.Int, scanId)
        .input("category", sql.VarChar, issue.category)
        .input("ruleCode", sql.NVarChar, issue.ruleCode)
        .input("title", sql.NVarChar, issue.title.slice(0, 300))
        .input("description", sql.NVarChar, issue.description?.slice(0, 2000) ?? null)
        .input("filePath", sql.NVarChar, issue.filePath)
        .input("startLine", sql.Int, issue.startLine)
        .input("endLine", sql.Int, issue.endLine)
        .input("codeElement", sql.NVarChar, issue.codeElement?.slice(0, 300) ?? null)
        .input("severity", sql.VarChar, severity)
        .input("confidenceLevel", sql.VarChar, issue.confidenceLevel ?? null)
        .input("recommendation", sql.NVarChar, issue.recommendation?.slice(0, 2000) ?? null)
        .input("codeSnippet", sql.NVarChar, issue.codeSnippet ?? null)
        .query(`
          INSERT INTO CodeQualityIssues
            (IssueNumber, ProjectId, ScanId, Category, RuleCode, Title, Description, FilePath, StartLine, EndLine, CodeElement, Severity, Status, ConfidenceLevel, Recommendation, CodeSnippet)
          VALUES
            (@issueNumber, @projectId, @scanId, @category, @ruleCode, @title, @description, @filePath, @startLine, @endLine, @codeElement, @severity, 'Open', @confidenceLevel, @recommendation, @codeSnippet)
        `);
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function persistMetrics(scanId: number, metrics: AnalyzerMetric[]): Promise<void> {
  const db = await getDb();
  for (const metric of metrics) {
    await db
      .request()
      .input("scanId", sql.Int, scanId)
      .input("metricType", sql.VarChar, metric.metricType)
      .input("metricName", sql.NVarChar, metric.metricName.slice(0, 200))
      .input("value", sql.Float, metric.value)
      .input("threshold", sql.Float, metric.threshold ?? null)
      .input("additionalData", sql.NVarChar, metric.additionalData ? JSON.stringify(metric.additionalData) : null)
      .query(
        "INSERT INTO CodeQualityMetrics (ScanId, MetricType, MetricName, Value, Threshold, AdditionalData) VALUES (@scanId, @metricType, @metricName, @value, @threshold, @additionalData)"
      );
  }
}

interface ScanOutcome {
  status: "Completed" | "PartiallyCompleted" | "Cancelled";
  filesScanned: number;
  linesOfCode: number;
  qualityScore: number;
}

async function executeScanInner(scanId: number, opts: StartScanOptions): Promise<ScanOutcome> {
  await logProgress(scanId, "Scan started.");

  const db = await getDb();
  const projectResult = await db
    .request()
    .input("id", sql.Int, opts.projectId)
    .query<ProjectRow>(
      "SELECT Id, Name, SourcePath, DefaultBranch, RepoConnectionId, RepoProvider, RepositoryOwner, RepositoryName, RepositoryRef FROM CodeQualityProjects WHERE Id = @id AND DeletedAt IS NULL"
    );
  const project = projectResult.recordset[0];
  if (!project) throw new Error("Project not found.");

  let effectiveSourcePath = project.SourcePath;
  if (project.RepoConnectionId && project.RepoProvider && project.RepositoryOwner && project.RepositoryName) {
    const ref = opts.branch ?? project.RepositoryRef ?? project.DefaultBranch ?? "HEAD";
    await logProgress(scanId, `Syncing ${project.RepositoryName}@${ref} from ${project.RepoProvider}...`);
    const connectionResult = await db
      .request()
      .input("id", sql.Int, project.RepoConnectionId)
      .query<{ Id: number; Provider: "GitHub" | "GitLab"; AuthMethod: "PAT" | "OAuthApp" | "GitHubApp"; InstanceUrl: string | null; AccessTokenEncrypted: string | null; InstallationId: number | null }>(
        "SELECT Id, Provider, AuthMethod, InstanceUrl, AccessTokenEncrypted, InstallationId FROM RepoConnections WHERE Id = @id AND DeletedAt IS NULL"
      );
    const row = connectionResult.recordset[0];
    if (!row) throw new Error(`The ${project.RepoProvider} connection for this project no longer exists.`);

    const connection: RepoConnectionRow = { id: row.Id, provider: row.Provider, authMethod: row.AuthMethod, instanceUrl: row.InstanceUrl, accessTokenEncrypted: row.AccessTokenEncrypted, installationId: row.InstallationId };
    const synced = await syncRepo({ connection, owner: project.RepositoryOwner, repo: project.RepositoryName, ref });
    effectiveSourcePath = synced.localPath;

    await db
      .request()
      .input("id", sql.Int, project.Id)
      .input("sourcePath", sql.NVarChar, synced.localPath)
      .input("commitSha", sql.NVarChar, synced.commitSha)
      .query("UPDATE CodeQualityProjects SET SourcePath = @sourcePath, LastSyncedCommitSha = @commitSha, LastSyncedAt = SYSUTCDATETIME() WHERE Id = @id");
    await logProgress(scanId, `Synced commit ${synced.commitSha.slice(0, 12)}.`);
  }

  const pathCheck = validateSourcePath(effectiveSourcePath);
  if (!pathCheck.ok) throw new Error(pathCheck.error ?? "Invalid source path.");

  const settings = await loadEffectiveSettings(opts.overrides);
  await logProgress(scanId, `Settings resolved. Excluded directories: ${settings.excludedDirectories.join(", ") || "(none)"}.`);

  const timeoutSeconds = await loadScanTimeoutSeconds();
  const deadline = Date.now() + timeoutSeconds * 1000;

  const roots = opts.overrides?.includedDirectories?.length
    ? opts.overrides.includedDirectories.map((d) => path.join(pathCheck.resolvedPath, d))
    : [pathCheck.resolvedPath];

  const files: SourceFile[] = [];
  let partial: "TimedOut" | "Cancelled" | null = null;
  let fileCounter = 0;

  walkLoop: for (const root of roots) {
    for await (const walked of walkSourceFiles(root, {
      excludedDirectories: settings.excludedDirectories,
      allowedExtensions: settings.allowedExtensions,
      maxTotalBytes: settings.maxScanSizeMb * 1024 * 1024,
    })) {
      if (Date.now() > deadline) {
        partial = "TimedOut";
        break walkLoop;
      }
      fileCounter++;
      if (fileCounter % 25 === 0 && (await currentStatus(scanId)) === "Cancelled") {
        partial = "Cancelled";
        break walkLoop;
      }

      const relativePath = path.relative(pathCheck.resolvedPath, walked.absolutePath);
      const file = await readSourceFile(walked.absolutePath, relativePath);
      if (!file) continue;
      files.push(file);
      if (files.length % 50 === 0) await logProgress(scanId, `Read ${files.length} files so far...`);
    }
  }

  await logProgress(scanId, `File walk complete: ${files.length} files read${partial ? ` (stopped early: ${partial})` : ""}.`);

  const allIssues: AnalyzerIssue[] = [];
  const complexityMetricsToStore: AnalyzerMetric[] = [];
  let complexityPenaltySum = 0;
  let functionCount = 0;
  let deadCodeCount = 0;
  let unusedVariableCount = 0;

  const complexityEnabled = settings.enabledRuleCodes.has("complexity.function-threshold");
  const deadCodeEnabled = settings.enabledRuleCodes.has("deadcode.unreachable");
  const unusedVarEnabled = settings.enabledRuleCodes.has("unused.variable");

  for (const file of files) {
    // Complexity metrics are always computed (the score formula needs them regardless of
    // whether the *issue* for a given function is being surfaced), but only functions above
    // the acceptable ceiling are persisted as rows - storing one metric row per function in a
    // large codebase would produce an unbounded number of "everything is fine" rows.
    const complexity = analyzeComplexity(file, settings);
    functionCount += complexity.metrics.length;
    for (const m of complexity.metrics) {
      if (m.threshold !== undefined && m.value > m.threshold) {
        complexityPenaltySum += m.value - m.threshold;
        complexityMetricsToStore.push(m);
      }
    }
    if (complexityEnabled) allIssues.push(...complexity.issues);

    if (deadCodeEnabled) {
      const deadCode = analyzeDeadCode(file);
      deadCodeCount += deadCode.issues.length;
      allIssues.push(...deadCode.issues);
    }

    if (unusedVarEnabled) {
      const unusedVars = analyzeUnusedVariables(file);
      unusedVariableCount += unusedVars.issues.length;
      allIssues.push(...unusedVars.issues);
    }

    const codingStandards = analyzeCodingStandards(file, settings);
    allIssues.push(...codingStandards.issues);
  }

  let unusedFunctionCount = 0;
  if (settings.enabledRuleCodes.has("unused.function")) {
    const unusedFunctions = analyzeUnusedFunctions(files);
    unusedFunctionCount = unusedFunctions.issues.length;
    allIssues.push(...unusedFunctions.issues);
  }

  let duplicatedLineCount = 0;
  let totalSignificantLineCount = 0;
  const duplicationMetrics: AnalyzerMetric[] = [];
  if (settings.enabledRuleCodes.has("duplication.block")) {
    const duplication = analyzeDuplication(files, settings);
    allIssues.push(...duplication.result.issues);
    duplicationMetrics.push(...duplication.result.metrics);
    duplicatedLineCount = duplication.duplicatedLineCount;
    totalSignificantLineCount = duplication.totalSignificantLineCount;
  }

  const linesOfCode = files.reduce((sum, f) => sum + f.lines.length, 0);
  const codingStandardsViolationSeverities = allIssues.filter((i) => i.category === "CodingStandard").map((i) => i.severity);

  const scoreBreakdown = calculateQualityScore(
    {
      linesOfCode,
      complexityPenaltySum,
      functionCount,
      duplicatedLines: duplicatedLineCount,
      totalSignificantLines: totalSignificantLineCount,
      deadCodeCount,
      unusedVariableCount,
      unusedFunctionCount,
      codingStandardsViolationSeverities,
    },
    settings
  );

  await logProgress(scanId, `Analysis complete: ${allIssues.length} issues found. Quality score: ${scoreBreakdown.overall}.`);

  const severityOverrides = await loadRuleSeverities();
  await persistIssues(scanId, opts.projectId, allIssues, severityOverrides);
  await persistMetrics(scanId, [
    ...complexityMetricsToStore,
    ...duplicationMetrics,
    { metricType: "DeadCode", metricName: "DeadCodeCount", value: deadCodeCount },
    { metricType: "UnusedVariable", metricName: "UnusedVariableCount", value: unusedVariableCount },
    { metricType: "UnusedFunction", metricName: "UnusedFunctionCount", value: unusedFunctionCount },
    { metricType: "CodingStandard", metricName: "ViolationCount", value: codingStandardsViolationSeverities.length },
    { metricType: "Score", metricName: "ComplexityScore", value: scoreBreakdown.categories.complexity },
    { metricType: "Score", metricName: "DuplicationScore", value: scoreBreakdown.categories.duplication },
    { metricType: "Score", metricName: "DeadCodeScore", value: scoreBreakdown.categories.deadCode },
    { metricType: "Score", metricName: "UnusedVariablesScore", value: scoreBreakdown.categories.unusedVariables },
    { metricType: "Score", metricName: "UnusedFunctionsScore", value: scoreBreakdown.categories.unusedFunctions },
    { metricType: "Score", metricName: "CodingStandardsScore", value: scoreBreakdown.categories.codingStandards },
  ]);

  return {
    status: partial === "Cancelled" ? "Cancelled" : partial === "TimedOut" ? "PartiallyCompleted" : "Completed",
    filesScanned: files.length,
    linesOfCode,
    qualityScore: scoreBreakdown.overall,
  };
}

// Outer safety net beyond executeScanInner's own error paths: if anything fails outside it
// (a DB write error while persisting results, an unexpected exception), the scan is marked
// 'Failed' instead of being left stuck at 'Running' forever.
export async function executeScan(scanId: number, opts: StartScanOptions): Promise<void> {
  const startedAt = Date.now();
  try {
    const outcome = await executeScanInner(scanId, opts);
    const db = await getDb();
    await db
      .request()
      .input("scanId", sql.Int, scanId)
      .input("status", sql.VarChar, outcome.status)
      .input("filesScanned", sql.Int, outcome.filesScanned)
      .input("linesOfCode", sql.Int, outcome.linesOfCode)
      .input("qualityScore", sql.Int, outcome.qualityScore)
      .input("durationMs", sql.Int, Date.now() - startedAt)
      .query(`
        UPDATE CodeQualityScans SET
          Status = @status, CompletedAt = SYSUTCDATETIME(), DurationMs = @durationMs,
          FilesScanned = @filesScanned, LinesOfCode = @linesOfCode, QualityScore = @qualityScore
        WHERE Id = @scanId
      `);
    await logProgress(scanId, `Scan ${outcome.status.toLowerCase()}.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[codeQuality runScan] scan ${scanId} failed:`, message);
    try {
      const db = await getDb();
      await db
        .request()
        .input("scanId", sql.Int, scanId)
        .input("errorMessage", sql.NVarChar, message.slice(0, 2000))
        .input("durationMs", sql.Int, Date.now() - startedAt)
        .query("UPDATE CodeQualityScans SET Status = 'Failed', CompletedAt = SYSUTCDATETIME(), DurationMs = @durationMs, ErrorMessage = @errorMessage WHERE Id = @scanId");
      await logProgress(scanId, `Scan failed: ${message}`);
    } catch {
      // Nothing more we can do - the scan stays in whatever state it last reached.
    }
  }
}

export async function runScan(opts: StartScanOptions): Promise<number> {
  const scanId = await createScanRow(opts);
  await executeScan(scanId, opts);
  return scanId;
}
