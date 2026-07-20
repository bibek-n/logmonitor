import fs from "fs/promises";
import path from "path";
import { getDb, sql } from "@/lib/db";
import { validateSourcePath } from "@/lib/pathSecurity";
import { walkSourceFiles } from "@/lib/fileWalker";
import { syncRepo } from "@/lib/repoConnections/sync";
import type { RepoConnectionRow } from "@/lib/repoConnections/types";
import { loadEffectiveSettings, loadScanTimeoutSeconds, loadRuleSeverities, type ScanConfigOverrides } from "./settings";
import { detectLaravel } from "./detectLaravel";
import { analyzeAppDebug } from "./appDebug";
import { analyzeAppKey } from "./appKey";
import { analyzeDotEnv } from "./dotenv";
import { analyzeCsrf } from "./csrf";
import { analyzeMassAssignment } from "./massAssignment";
import { analyzeValidation } from "./validation";
import { analyzeSanitization } from "./sanitization";
import { analyzeStorageLinks } from "./storageLinks";
import { analyzeQueue } from "./queue";
import { calculateSecurityScore } from "./securityScore";
import type { AnalyzerIssue, IssueSeverity, ProjectContext, SourceFile } from "./types";

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
  // Same GitHub/GitLab owner/repo-field repurposing convention as CodeQualityProjects - see
  // codeQuality/runScan.ts's own ProjectRow comment for the full explanation.
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
      .query("INSERT INTO LaravelSecurityScanLog (ScanId, Message) VALUES (@scanId, @message)");
  } catch (err) {
    console.error("[laravelSecurity runScan] failed to write progress log line:", err instanceof Error ? err.message : err);
  }
}

async function currentStatus(scanId: number): Promise<string | null> {
  const db = await getDb();
  const result = await db.request().input("scanId", sql.Int, scanId).query<{ Status: string }>("SELECT Status FROM LaravelSecurityScans WHERE Id = @scanId");
  return result.recordset[0]?.Status ?? null;
}

// Same createScanRow()/executeScan() split as codeQuality/runScan.ts - the API route responds
// with the scan id immediately, then executeScan() keeps going in the background.
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
      INSERT INTO LaravelSecurityScans (ProjectId, Branch, ScanType, Status, StartedByUserId, StartedAt, ConfigSnapshot)
      OUTPUT INSERTED.Id
      VALUES (@projectId, @branch, @scanType, 'Running', @startedByUserId, SYSUTCDATETIME(), @configSnapshot)
    `);
  return insertResult.recordset[0].Id;
}

async function readSourceFile(absolutePath: string, relativePath: string): Promise<SourceFile | null> {
  try {
    const buffer = await fs.readFile(absolutePath);
    if (buffer.includes(0)) return null; // binary file masquerading under an allowed extension
    const content = buffer.toString("utf8");
    return { absolutePath, relativePath, content, lines: content.split(/\r\n|\r|\n/) };
  } catch {
    return null;
  }
}

async function persistIssues(scanId: number, projectId: number, issues: AnalyzerIssue[], severityOverrides: Map<string, IssueSeverity>): Promise<void> {
  if (issues.length === 0) return;
  const db = await getDb();
  const transaction = new sql.Transaction(db);
  await transaction.begin();
  try {
    const maxResult = await new sql.Request(transaction).query<{ MaxNum: number | null }>(
      "SELECT MAX(CAST(SUBSTRING(IssueNumber, 4, 10) AS INT)) AS MaxNum FROM LaravelSecurityIssues WITH (UPDLOCK, HOLDLOCK) WHERE IssueNumber LIKE 'LS-%'"
    );
    let next = (maxResult.recordset[0]?.MaxNum ?? 0) + 1;

    for (const issue of issues) {
      const issueNumber = `LS-${String(next).padStart(5, "0")}`;
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
          INSERT INTO LaravelSecurityIssues
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

interface ScanOutcome {
  status: "Completed" | "PartiallyCompleted" | "Cancelled";
  filesScanned: number;
  securityScore: number;
}

async function executeScanInner(scanId: number, opts: StartScanOptions): Promise<ScanOutcome> {
  await logProgress(scanId, "Scan started.");

  const db = await getDb();
  const projectResult = await db
    .request()
    .input("id", sql.Int, opts.projectId)
    .query<ProjectRow>(
      "SELECT Id, Name, SourcePath, DefaultBranch, RepoConnectionId, RepoProvider, RepositoryOwner, RepositoryName, RepositoryRef FROM LaravelSecurityProjects WHERE Id = @id AND DeletedAt IS NULL"
    );
  const project = projectResult.recordset[0];
  if (!project) throw new Error("Project not found.");

  let effectiveSourcePath = project.SourcePath;
  const isGitSourced = !!(project.RepoConnectionId && project.RepoProvider && project.RepositoryOwner && project.RepositoryName);
  if (isGitSourced) {
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
    const synced = await syncRepo({ connection, owner: project.RepositoryOwner!, repo: project.RepositoryName!, ref });
    effectiveSourcePath = synced.localPath;

    await db
      .request()
      .input("id", sql.Int, project.Id)
      .input("sourcePath", sql.NVarChar, synced.localPath)
      .input("commitSha", sql.NVarChar, synced.commitSha)
      .query("UPDATE LaravelSecurityProjects SET SourcePath = @sourcePath, LastSyncedCommitSha = @commitSha, LastSyncedAt = SYSUTCDATETIME() WHERE Id = @id");
    await logProgress(scanId, `Synced commit ${synced.commitSha.slice(0, 12)}.`);
  }

  const pathCheck = validateSourcePath(effectiveSourcePath);
  if (!pathCheck.ok) throw new Error(pathCheck.error ?? "Invalid source path.");

  const detection = await detectLaravel(pathCheck.resolvedPath);
  await logProgress(scanId, detection.isLaravel ? `Detected a Laravel project. ${detection.reason}` : `Warning: ${detection.reason}`);
  await db
    .request()
    .input("id", sql.Int, project.Id)
    .input("version", sql.NVarChar, detection.laravelVersion)
    .query("UPDATE LaravelSecurityProjects SET LaravelVersion = @version WHERE Id = @id");

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

  const ctx: ProjectContext = { rootPath: pathCheck.resolvedPath, isGitSourced };
  const enabled = (code: string) => settings.enabledRuleCodes.size === 0 || settings.enabledRuleCodes.has(code);

  const allIssues: AnalyzerIssue[] = [];

  if (["appdebug.enabled-in-env", "appdebug.enabled-in-config"].some(enabled)) {
    allIssues.push(...(await analyzeAppDebug(ctx)).issues);
  }
  if (["appkey.missing", "appkey.weak-or-default"].some(enabled)) {
    allIssues.push(...(await analyzeAppKey(ctx)).issues);
  }
  if (["dotenv.committed", "dotenv.not-gitignored", "dotenv.sensitive-default"].some(enabled)) {
    allIssues.push(...(await analyzeDotEnv(ctx)).issues);
  }
  if (["csrf.missing-token-in-form", "csrf.route-excluded"].some(enabled)) {
    allIssues.push(...analyzeCsrf(files).issues);
  }
  if (["massassignment.guarded-empty", "massassignment.fillable-missing", "massassignment.request-all"].some(enabled)) {
    allIssues.push(...analyzeMassAssignment(files).issues);
  }
  if (["validation.controller-missing", "validation.route-param-unvalidated"].some(enabled)) {
    allIssues.push(...analyzeValidation(files).issues);
  }
  if (["sanitization.raw-blade-echo", "sanitization.raw-html-helper"].some(enabled)) {
    allIssues.push(...analyzeSanitization(files).issues);
  }
  if (["storagelinks.missing-symlink", "storagelinks.public-disk-sensitive"].some(enabled)) {
    allIssues.push(...(await analyzeStorageLinks(ctx, files)).issues);
  }
  if (["queue.sync-driver-in-production", "queue.job-missing-failed-handling"].some(enabled)) {
    allIssues.push(...(await analyzeQueue(ctx, files)).issues);
  }

  const filteredIssues = allIssues.filter((i) => enabled(i.ruleCode));
  const scoreBreakdown = calculateSecurityScore(filteredIssues, settings);

  await logProgress(scanId, `Analysis complete: ${filteredIssues.length} issues found. Security score: ${scoreBreakdown.overall}.`);

  const severityOverrides = await loadRuleSeverities();
  await persistIssues(scanId, opts.projectId, filteredIssues, severityOverrides);

  return {
    status: partial === "Cancelled" ? "Cancelled" : partial === "TimedOut" ? "PartiallyCompleted" : "Completed",
    filesScanned: files.length,
    securityScore: scoreBreakdown.overall,
  };
}

// Outer safety net beyond executeScanInner's own error paths - identical shape to codeQuality/
// runScan.ts's executeScan(): if anything fails, the scan is marked 'Failed' instead of being
// left stuck at 'Running' forever.
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
      .input("securityScore", sql.Int, outcome.securityScore)
      .input("durationMs", sql.Int, Date.now() - startedAt)
      .query(`
        UPDATE LaravelSecurityScans SET
          Status = @status, CompletedAt = SYSUTCDATETIME(), DurationMs = @durationMs,
          FilesScanned = @filesScanned, SecurityScore = @securityScore
        WHERE Id = @scanId
      `);
    await logProgress(scanId, `Scan ${outcome.status.toLowerCase()}.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[laravelSecurity runScan] scan ${scanId} failed:`, message);
    try {
      const db = await getDb();
      await db
        .request()
        .input("scanId", sql.Int, scanId)
        .input("errorMessage", sql.NVarChar, message.slice(0, 2000))
        .input("durationMs", sql.Int, Date.now() - startedAt)
        .query("UPDATE LaravelSecurityScans SET Status = 'Failed', CompletedAt = SYSUTCDATETIME(), DurationMs = @durationMs, ErrorMessage = @errorMessage WHERE Id = @scanId");
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
