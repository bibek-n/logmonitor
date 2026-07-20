import type { AnalyzerIssue, AnalyzerResult, SourceFile } from "./types";
import { extractSnippet } from "./types";

const FORM_OPEN = /<form\b[^>]*>/i;
const UNSAFE_METHOD = /method\s*=\s*["']?(post|put|patch|delete)/i;
const CSRF_TOKEN = /@csrf\b|csrf_field\s*\(/;
const MAX_FORM_SCAN_LINES = 80;

function isBladeFile(file: SourceFile): boolean {
  return file.relativePath.toLowerCase().endsWith(".blade.php");
}

// Two independent CSRF checks over already-walked .php/.blade.php files (see runScan.ts) -
// no PHP/Blade parser is installed in this app, so both are line/regex heuristics over raw
// text, same "small hand-written rule set" approach codeQuality/codingStandards.ts documents
// for its own checks.
export function analyzeCsrf(files: SourceFile[]): AnalyzerResult {
  const issues: AnalyzerIssue[] = [];

  for (const file of files) {
    if (isBladeFile(file)) {
      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i];
        if (!FORM_OPEN.test(line) || !UNSAFE_METHOD.test(line)) continue;

        const scanEnd = Math.min(file.lines.length, i + MAX_FORM_SCAN_LINES);
        let closeIdx = scanEnd;
        let hasToken = false;
        for (let j = i; j < scanEnd; j++) {
          if (CSRF_TOKEN.test(file.lines[j])) {
            hasToken = true;
            break;
          }
          if (/<\/form>/i.test(file.lines[j])) {
            closeIdx = j;
            break;
          }
        }

        if (!hasToken) {
          issues.push({
            category: "Csrf",
            ruleCode: "csrf.missing-token-in-form",
            title: "Form missing @csrf token",
            description: "A <form> using a state-changing HTTP method (POST/PUT/PATCH/DELETE) does not appear to include @csrf (or csrf_field()) before its closing tag, so Laravel's VerifyCsrfToken middleware will reject every real submission - or, if CSRF protection was disabled to work around that, the form is exploitable via cross-site request forgery.",
            filePath: file.relativePath,
            startLine: i + 1,
            endLine: closeIdx + 1,
            codeElement: "<form>",
            severity: "High",
            confidenceLevel: "Medium",
            recommendation: "Add @csrf immediately inside the <form> tag.",
            codeSnippet: extractSnippet(file, i + 1, i + 1),
          });
        }
      }
    }

    if (/VerifyCsrfToken/.test(file.content)) {
      const exceptMatch = file.content.match(/\$except\s*=\s*\[([^\]]*)\]/);
      if (exceptMatch && exceptMatch[1].trim().length > 0) {
        const lineIdx = file.lines.findIndex((l) => /\$except\s*=\s*\[/.test(l));
        issues.push({
          category: "Csrf",
          ruleCode: "csrf.route-excluded",
          title: "Routes excluded from CSRF verification",
          description: `VerifyCsrfToken::$except lists one or more URI patterns that bypass CSRF protection entirely: ${exceptMatch[1].trim().slice(0, 300)}`,
          filePath: file.relativePath,
          startLine: lineIdx === -1 ? 1 : lineIdx + 1,
          endLine: lineIdx === -1 ? 1 : lineIdx + 1,
          codeElement: "$except",
          severity: "High",
          confidenceLevel: "High",
          recommendation: "Remove routes from $except unless they are genuinely stateless/token-authenticated (e.g. a webhook verified by its own signature). Prefer excluding by named route/middleware over broad URI wildcards.",
          codeSnippet: lineIdx === -1 ? undefined : extractSnippet(file, lineIdx + 1, lineIdx + 1),
        });
      }
    }

    if (/validateCsrfTokens\s*\(/.test(file.content) && /except\s*:/.test(file.content)) {
      const lineIdx = file.lines.findIndex((l) => /validateCsrfTokens\s*\(/.test(l));
      issues.push({
        category: "Csrf",
        ruleCode: "csrf.route-excluded",
        title: "Routes excluded from CSRF verification (bootstrap/app.php)",
        description: "->validateCsrfTokens(except: [...]) excludes one or more URI patterns from CSRF verification.",
        filePath: file.relativePath,
        startLine: lineIdx === -1 ? 1 : lineIdx + 1,
        endLine: lineIdx === -1 ? 1 : lineIdx + 1,
        codeElement: "validateCsrfTokens",
        severity: "High",
        confidenceLevel: "High",
        recommendation: "Remove routes from the except list unless they are genuinely stateless/token-authenticated.",
        codeSnippet: lineIdx === -1 ? undefined : extractSnippet(file, lineIdx + 1, Math.min(file.lines.length, lineIdx + 4)),
      });
    }
  }

  return { issues };
}
