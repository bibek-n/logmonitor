import ts from "typescript";
import type { AnalyzerIssue, AnalyzerResult, SourceFile } from "./types";
import { extractSnippet } from "./types";

const TERMINATING_KINDS = new Set([
  ts.SyntaxKind.ReturnStatement,
  ts.SyntaxKind.ThrowStatement,
  ts.SyntaxKind.BreakStatement,
  ts.SyntaxKind.ContinueStatement,
]);

function scriptKindFor(relativePath: string): ts.ScriptKind {
  if (relativePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (relativePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (relativePath.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

// Finds code that follows a return/throw/break/continue in the same statement list - it can
// never execute regardless of any condition. Hoisted declarations (function/class) break a
// contiguous unreachable run without themselves being flagged, since they're still valid to
// reference earlier in the same scope via hoisting. Does not attempt the harder case of both
// branches of an if/else terminating (that needs real control-flow analysis) - documented as
// a known limitation rather than risking false positives from a half-correct CFG.
export function analyzeDeadCode(file: SourceFile): AnalyzerResult {
  const issues: AnalyzerIssue[] = [];
  const sourceFile = ts.createSourceFile(file.relativePath, file.content, ts.ScriptTarget.Latest, true, scriptKindFor(file.relativePath));

  function flushRun(runStart: ts.Statement | null, runEnd: ts.Statement | null) {
    if (!runStart || !runEnd) return;
    const startLine = sourceFile.getLineAndCharacterOfPosition(runStart.getStart(sourceFile)).line + 1;
    const endLine = sourceFile.getLineAndCharacterOfPosition(runEnd.end).line + 1;
    issues.push({
      category: "DeadCode",
      ruleCode: "deadcode.unreachable",
      title: "Unreachable code",
      description: "This code follows a return, throw, break, or continue statement in the same block and can never execute.",
      filePath: file.relativePath,
      startLine,
      endLine,
      severity: "Medium",
      confidenceLevel: "High",
      recommendation: "Remove this code, or move it before the terminating statement if it was meant to run.",
      codeSnippet: extractSnippet(file, startLine, endLine),
    });
  }

  function scanStatementList(statements: readonly ts.Statement[]) {
    let seenTerminator = false;
    let runStart: ts.Statement | null = null;
    let runEnd: ts.Statement | null = null;

    for (const stmt of statements) {
      if (seenTerminator) {
        if (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) {
          flushRun(runStart, runEnd);
          runStart = null;
          runEnd = null;
        } else {
          if (!runStart) runStart = stmt;
          runEnd = stmt;
        }
      }
      if (!seenTerminator && TERMINATING_KINDS.has(stmt.kind)) seenTerminator = true;
    }
    flushRun(runStart, runEnd);
  }

  function visit(node: ts.Node) {
    if (ts.isBlock(node)) scanStatementList(node.statements);
    else if (ts.isSourceFile(node)) scanStatementList(node.statements);
    else if (ts.isCaseClause(node) || ts.isDefaultClause(node)) scanStatementList(node.statements);
    else if (ts.isModuleBlock(node)) scanStatementList(node.statements);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { issues, metrics: [{ metricType: "DeadCode", metricName: "UnreachableBlockCount", value: issues.length }] };
}
