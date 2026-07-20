import type { AnalyzerIssue, AnalyzerResult, ProjectContext, SourceFile } from "./types";
import { extractSnippet } from "./types";
import { readOptionalFile } from "./fsHelpers";

const SENSITIVE_JOB_WORDS = /payment|charge|invoice|refund|mail|email|notify|notification|webhook|api|stripe|paypal/i;
const IMPLEMENTS_SHOULD_QUEUE = /implements\s+(?:[\w,\\\s]*\b)?ShouldQueue\b/;
const HAS_FAILED_HANDLER = /function\s+failed\s*\(/;

// queue.sync-driver-in-production reads .env directly (see fsHelpers.ts); queue.job-missing-
// failed-handling walks already-read .php files for queueable job classes that look like they
// do something worth alerting on if they silently fail.
export async function analyzeQueue(ctx: ProjectContext, files: SourceFile[]): Promise<AnalyzerResult> {
  const issues: AnalyzerIssue[] = [];

  const envFile = await readOptionalFile(ctx.rootPath, ".env");
  if (envFile) {
    const lineIdx = envFile.lines.findIndex((l) => /^\s*QUEUE_CONNECTION\s*=/.test(l));
    if (lineIdx !== -1) {
      const match = envFile.lines[lineIdx].match(/^\s*QUEUE_CONNECTION\s*=\s*(.*)$/);
      const value = (match?.[1] ?? "").split("#")[0].trim().replace(/^["']|["']$/g, "");
      if (value.toLowerCase() === "sync") {
        issues.push({
          category: "Queue",
          ruleCode: "queue.sync-driver-in-production",
          title: "QUEUE_CONNECTION=sync configured",
          description: "The queue connection is 'sync', so every dispatched job runs immediately and inline on the request thread instead of asynchronously. Fine for local development; in a real deployment it means no retries/backoff on failure, and queued work runs with the full context (and blast radius) of the original request.",
          filePath: envFile.relativePath,
          startLine: lineIdx + 1,
          endLine: lineIdx + 1,
          codeElement: "QUEUE_CONNECTION",
          severity: "Low",
          confidenceLevel: "Medium",
          recommendation: "Use a real queue driver (database, redis, sqs) outside of local development, and run a queue worker.",
          codeSnippet: extractSnippet(envFile, lineIdx + 1, lineIdx + 1),
        });
      }
    }
  }

  for (const file of files) {
    if (!IMPLEMENTS_SHOULD_QUEUE.test(file.content)) continue;
    if (!SENSITIVE_JOB_WORDS.test(file.content)) continue;
    if (HAS_FAILED_HANDLER.test(file.content)) continue;

    const classLineIdx = file.lines.findIndex((l) => /class\s+\w+/.test(l));
    issues.push({
      category: "Queue",
      ruleCode: "queue.job-missing-failed-handling",
      title: "Queueable job has no failed() handler",
      description: "This job implements ShouldQueue and appears to perform a sensitive action (payment/email/notification/webhook/API call), but defines no failed() method - if the job exhausts its retries, the failure is only visible in the failed_jobs table, with nothing alerting anyone or compensating for the partial action.",
      filePath: file.relativePath,
      startLine: classLineIdx === -1 ? 1 : classLineIdx + 1,
      endLine: classLineIdx === -1 ? 1 : classLineIdx + 1,
      severity: "Low",
      confidenceLevel: "Low",
      recommendation: "Add a failed(Throwable $exception) method that logs, alerts, or compensates (e.g. reverses a partial charge) when this job exhausts its retries.",
      codeSnippet: extractSnippet(file, classLineIdx === -1 ? 1 : classLineIdx + 1, classLineIdx === -1 ? 1 : classLineIdx + 1),
    });
  }

  return { issues };
}
