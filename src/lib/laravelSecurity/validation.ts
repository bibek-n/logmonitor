import type { AnalyzerIssue, AnalyzerResult, SourceFile } from "./types";
import { extractSnippet } from "./types";

function normalize(p: string): string {
  return p.replace(/\\/g, "/");
}

const METHOD_START = /(?:public|protected)\s+function\s+(\w+)\s*\(([^)]*)\)/;
const READS_INPUT = /\$request->(input|get|post|all|query)\s*\(|request\(\)->(input|get|post|all|query)\s*\(|Input::(get|all)\s*\(/;
const VALIDATES = /->validate\s*\(|Validator::make\s*\(|\$this->validate\s*\(/;
const ROUTE_LINE = /Route::(get|post|put|patch|delete)\s*\(\s*['"]([^'"]*\{[^}]+\}[^'"]*)['"]/;

// Grabs the body of a `function name(...) { ... }` starting at `startIdx` via brace-counting,
// not a real parser - PHP braces inside string literals/comments could throw the count off,
// same tradeoff codeQuality's regex-based coding-standards checks accept. Good enough for a
// heuristic security scanner over conventionally-formatted controller code.
function extractFunctionBody(lines: string[], startIdx: number): { endIdx: number; body: string } {
  let depth = 0;
  let started = false;
  const bodyLines: string[] = [];
  let endIdx = startIdx;
  for (let i = startIdx; i < lines.length && i < startIdx + 300; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") {
        depth++;
        started = true;
      } else if (ch === "}") {
        depth--;
      }
    }
    bodyLines.push(line);
    endIdx = i;
    if (started && depth <= 0) break;
  }
  return { endIdx, body: bodyLines.join("\n") };
}

// Two checks: (1) a controller method that reads request input but never validates it, and
// (2) a route parameter with no ->where() constraint. Both are intentionally low/medium
// confidence heuristics - see LaravelSecurityRules seed data for the documented reasoning.
export function analyzeValidation(files: SourceFile[]): AnalyzerResult {
  const issues: AnalyzerIssue[] = [];

  for (const file of files) {
    const path = normalize(file.relativePath).toLowerCase();

    if (path.includes("http/controllers")) {
      for (let i = 0; i < file.lines.length; i++) {
        const match = file.lines[i].match(METHOD_START);
        if (!match) continue;
        const [, methodName, params] = match;

        const formRequestMatch = params.match(/\b(\w*Request)\s+\$\w+/);
        const hasFormRequest = !!formRequestMatch && formRequestMatch[1] !== "Request";
        if (hasFormRequest) continue; // a Form Request class validates in its own rules() method

        const { endIdx, body } = extractFunctionBody(file.lines, i);
        if (!READS_INPUT.test(body) || VALIDATES.test(body)) continue;

        issues.push({
          category: "Validation",
          ruleCode: "validation.controller-missing",
          title: `${methodName}() reads request input with no validation`,
          description: `${methodName}() reads request input (->input()/->get()/->post()/->all()) but never calls ->validate(), Validator::make(), or type-hints a Form Request. Unvalidated input can carry unexpected types, missing required fields, or values that break downstream assumptions.`,
          filePath: file.relativePath,
          startLine: i + 1,
          endLine: endIdx + 1,
          codeElement: methodName,
          severity: "Medium",
          confidenceLevel: "Medium",
          recommendation: "Validate incoming data with $request->validate([...]) or a dedicated Form Request before using it.",
          codeSnippet: extractSnippet(file, i + 1, i + 1),
        });
      }
    }

    if (path.includes("routes/")) {
      file.lines.forEach((line, idx) => {
        const match = line.match(ROUTE_LINE);
        if (!match) return;
        const lookahead = file.lines.slice(idx, idx + 3).join(" ");
        if (/->where\s*\(/.test(lookahead)) return;
        issues.push({
          category: "Validation",
          ruleCode: "validation.route-param-unvalidated",
          title: "Route parameter has no ->where() constraint",
          description: `The route "${match[2]}" declares a parameter with no ->where() regex constraint. Unless the controller uses typed Eloquent route-model binding (which Laravel validates automatically), the raw parameter value reaches the controller unconstrained.`,
          filePath: file.relativePath,
          startLine: idx + 1,
          endLine: idx + 1,
          severity: "Low",
          confidenceLevel: "Low",
          recommendation: "Add a ->where('param', 'regex') constraint, or ensure the controller parameter is type-hinted to an Eloquent model so Laravel's implicit route-model binding validates it.",
          codeSnippet: extractSnippet(file, idx + 1, idx + 1),
        });
      });
    }
  }

  return { issues };
}
