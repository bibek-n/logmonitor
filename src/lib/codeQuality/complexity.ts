import ts from "typescript";
import type { AnalyzerIssue, AnalyzerMetric, AnalyzerResult, EffectiveScanSettings, SourceFile } from "./types";
import { extractSnippet } from "./types";

interface FunctionComplexity {
  name: string;
  startLine: number;
  endLine: number;
  complexity: number;
}

const FUNCTION_LIKE_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
  ts.SyntaxKind.Constructor,
]);

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return FUNCTION_LIKE_KINDS.has(node.kind);
}

// Best-effort human-readable name: the function's own name, or the identifier it's being
// assigned to (const foo = () => {...}), or the property it's assigned to (obj.foo = ...),
// falling back to "<anonymous>".
function nameFunctionLike(node: ts.FunctionLikeDeclaration): string {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  const parent = node.parent;
  if (parent) {
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
    if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
    if (ts.isBinaryExpression(parent) && ts.isPropertyAccessExpression(parent.left)) return parent.left.name.text;
  }
  return "<anonymous>";
}

// McCabe cyclomatic complexity: starts at 1 (one path through the function), +1 per
// additional decision point. Walks the function's own body but does NOT descend into a
// nested function-like node's body — that nested function gets its own separate entry
// (and its own complexity count) rather than inflating its parent's.
function computeComplexity(node: ts.FunctionLikeDeclaration): number {
  let complexity = 1;

  function visit(n: ts.Node) {
    if (isFunctionLike(n) && n !== node) return; // nested function - counted separately

    switch (n.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.ConditionalExpression: // ternary
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.CatchClause:
        complexity++;
        break;
      case ts.SyntaxKind.CaseClause:
        complexity++; // DefaultClause deliberately excluded - it's the fallback path, not a branch
        break;
      case ts.SyntaxKind.BinaryExpression: {
        const op = (n as ts.BinaryExpression).operatorToken.kind;
        if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) complexity++;
        break;
      }
      default:
        break;
    }
    ts.forEachChild(n, visit);
  }

  if (node.body) ts.forEachChild(node.body, visit);
  return complexity;
}

function collectFunctionComplexities(sourceFile: ts.SourceFile): FunctionComplexity[] {
  const results: FunctionComplexity[] = [];

  function visit(node: ts.Node) {
    if (isFunctionLike(node) && node.body) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const end = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
      results.push({ name: nameFunctionLike(node), startLine: start, endLine: end, complexity: computeComplexity(node) });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return results;
}

function scriptKindFor(relativePath: string): ts.ScriptKind {
  if (relativePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (relativePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (relativePath.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function severityForComplexity(value: number, settings: EffectiveScanSettings): "Medium" | "High" | "Critical" | null {
  if (value <= settings.complexityLowMax) return null; // acceptable, no issue
  if (value <= settings.complexityMediumMax) return "Medium";
  if (value <= settings.complexityHighMax) return "High";
  return "Critical";
}

export function analyzeComplexity(file: SourceFile, settings: EffectiveScanSettings): AnalyzerResult {
  const issues: AnalyzerIssue[] = [];
  const metrics: AnalyzerMetric[] = [];

  const sourceFile = ts.createSourceFile(file.relativePath, file.content, ts.ScriptTarget.Latest, true, scriptKindFor(file.relativePath));
  const functions = collectFunctionComplexities(sourceFile);

  for (const fn of functions) {
    const severity = severityForComplexity(fn.complexity, settings);
    metrics.push({
      metricType: "Complexity",
      metricName: fn.name,
      value: fn.complexity,
      threshold: settings.complexityLowMax,
      additionalData: { filePath: file.relativePath, startLine: fn.startLine, endLine: fn.endLine },
    });

    if (!severity) continue;
    issues.push({
      category: "Complexity",
      ruleCode: "complexity.function-threshold",
      title: `Function "${fn.name}" has cyclomatic complexity ${fn.complexity}`,
      description: `The function/method "${fn.name}" has a cyclomatic complexity of ${fn.complexity}, above the configured acceptable ceiling of ${settings.complexityLowMax}.`,
      filePath: file.relativePath,
      startLine: fn.startLine,
      endLine: fn.endLine,
      codeElement: fn.name,
      severity,
      confidenceLevel: "High",
      recommendation: "Break this function into smaller functions, each handling one responsibility, to reduce the number of independent paths through it.",
      codeSnippet: extractSnippet(file, fn.startLine, fn.endLine),
    });
  }

  return { issues, metrics };
}

export function summarizeComplexityMetrics(perFileMetrics: AnalyzerMetric[]): { average: number; max: number; functionsAboveThreshold: number } {
  if (perFileMetrics.length === 0) return { average: 0, max: 0, functionsAboveThreshold: 0 };
  const values = perFileMetrics.map((m) => m.value);
  const sum = values.reduce((a, b) => a + b, 0);
  const aboveThreshold = perFileMetrics.filter((m) => m.threshold !== undefined && m.value > m.threshold).length;
  return {
    average: Math.round((sum / values.length) * 100) / 100,
    max: Math.max(...values),
    functionsAboveThreshold: aboveThreshold,
  };
}
