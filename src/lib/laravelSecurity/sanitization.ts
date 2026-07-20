import type { AnalyzerIssue, AnalyzerResult, SourceFile } from "./types";
import { extractSnippet } from "./types";

// Helpers/functions that legitimately produce or already-sanitize HTML - a raw echo of one of
// these is not a finding, even though it superficially matches "{!! $x !!}".
const SAFE_CALL = /^(config|asset|route|url|trans|__|csrf_field|method_field|session|old|clean|purify|strip_tags|e)\s*\(/;

function isBladeFile(file: SourceFile): boolean {
  return file.relativePath.toLowerCase().endsWith(".blade.php");
}

function lineNumberAt(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

// Blade's {{ }} auto-escapes via htmlspecialchars(); {!! !!} deliberately skips that. Both
// checks here are the same underlying risk (unescaped HTML output reaching the browser),
// surfaced through Blade's raw-echo syntax and through PHP's HtmlString/raw() helper
// respectively. Neither can trace true data flow without a real parser - a variable reference
// that isn't a known-safe helper call is flagged, which will over-report on genuinely-trusted
// server-generated HTML (e.g. a variable that was already run through a purifier upstream) -
// documented as Medium/High confidence, not certainty, matching this module's heuristic
// approach everywhere else.
export function analyzeSanitization(files: SourceFile[]): AnalyzerResult {
  const issues: AnalyzerIssue[] = [];

  for (const file of files) {
    if (isBladeFile(file)) {
      const regex = /\{!!\s*([^{}]*?)\s*!!\}/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(file.content)) !== null) {
        const inner = match[1].trim();
        if (!inner.includes("$")) continue;
        if (SAFE_CALL.test(inner)) continue;
        const lineNo = lineNumberAt(file.content, match.index);
        issues.push({
          category: "Sanitization",
          ruleCode: "sanitization.raw-blade-echo",
          title: "Unescaped Blade output of a variable",
          description: `{!! ${inner.slice(0, 120)} !!} outputs raw, unescaped HTML. If this value can be influenced by user input anywhere upstream, this is a stored or reflected XSS vector.`,
          filePath: file.relativePath,
          startLine: lineNo,
          endLine: lineNo,
          codeElement: inner.slice(0, 100),
          severity: "High",
          confidenceLevel: "Medium",
          recommendation: "Use {{ }} (auto-escaped) unless this value is genuinely trusted, pre-sanitized HTML - if so, sanitize explicitly with a library like HTMLPurifier before echoing raw.",
          codeSnippet: extractSnippet(file, lineNo, lineNo),
        });
      }
    }

    const rawHelperRegex = /(new\s+HtmlString\s*\(\s*([^)]*)\)|->raw\s*\(\s*([^)]*)\))/g;
    let helperMatch: RegExpExecArray | null;
    while ((helperMatch = rawHelperRegex.exec(file.content)) !== null) {
      const arg = (helperMatch[2] ?? helperMatch[3] ?? "").trim();
      if (!arg.includes("$")) continue;
      if (SAFE_CALL.test(arg)) continue;
      const lineNo = lineNumberAt(file.content, helperMatch.index);
      issues.push({
        category: "Sanitization",
        ruleCode: "sanitization.raw-html-helper",
        title: "Raw HTML helper wraps a variable",
        description: `${helperMatch[0].slice(0, 80)} wraps a variable as raw HTML with no visible sanitization. If the value originates from user input, this bypasses Blade's auto-escaping entirely.`,
        filePath: file.relativePath,
        startLine: lineNo,
        endLine: lineNo,
        severity: "High",
        confidenceLevel: "Medium",
        recommendation: "Sanitize the value (e.g. strip_tags(), an HTML purifier) before wrapping it as raw HTML, or drop the raw wrapper and let Blade escape it normally.",
        codeSnippet: extractSnippet(file, lineNo, lineNo),
      });
    }
  }

  return { issues };
}
