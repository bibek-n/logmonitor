import ts from "typescript";
import type { AnalyzerIssue, AnalyzerResult, EffectiveScanSettings, SourceFile } from "./types";
import { extractSnippet } from "./types";

function scriptKindFor(relativePath: string): ts.ScriptKind {
  if (relativePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (relativePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (relativePath.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

const CAMEL_CASE = /^_?[a-z][a-zA-Z0-9]*$/;
const UPPER_SNAKE_CASE = /^[A-Z][A-Z0-9_]*$/;
const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;

// A small, hand-written rule set - no ESLint is installed in this app (see the module's own
// architecture notes on tool selection), so these six checks stand in for "coding standards"
// for a first version. Each rule is independently toggleable via settings.enabledRuleCodes;
// severity for every emitted issue is a placeholder here and gets remapped by the scan
// orchestrator from CodeQualityRules.DefaultSeverity (the actual configured value) before
// persisting - see runScan.ts.
export function analyzeCodingStandards(file: SourceFile, settings: EffectiveScanSettings): AnalyzerResult {
  const issues: AnalyzerIssue[] = [];
  const enabled = (code: string) => settings.enabledRuleCodes.size === 0 || settings.enabledRuleCodes.has(code);
  const sourceFile = ts.createSourceFile(file.relativePath, file.content, ts.ScriptTarget.Latest, true, scriptKindFor(file.relativePath));

  function lineOf(node: ts.Node, useEnd = false): number {
    return sourceFile.getLineAndCharacterOfPosition(useEnd ? node.end : node.getStart(sourceFile)).line + 1;
  }

  function push(ruleCode: string, title: string, description: string, startLine: number, endLine: number, recommendation: string, codeElement?: string) {
    issues.push({
      category: "CodingStandard",
      ruleCode,
      title,
      description,
      filePath: file.relativePath,
      startLine,
      endLine,
      codeElement,
      severity: "Low",
      confidenceLevel: "High",
      recommendation,
      codeSnippet: extractSnippet(file, startLine, endLine),
    });
  }

  if (enabled("style.max-line-length")) {
    file.lines.forEach((line, idx) => {
      if (line.length > settings.maxLineLength) {
        push(
          "style.max-line-length",
          `Line exceeds ${settings.maxLineLength} characters`,
          `This line is ${line.length} characters long, above the configured maximum of ${settings.maxLineLength}.`,
          idx + 1,
          idx + 1,
          "Break this line into multiple lines or extract part of the expression into a named variable."
        );
      }
    });
  }

  function isFunctionBody(block: ts.Block): boolean {
    const parent = block.parent;
    return (
      ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isArrowFunction(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isConstructorDeclaration(parent) ||
      ts.isGetAccessor(parent) ||
      ts.isSetAccessor(parent)
    );
  }

  function checkReassignment(scopeRoot: ts.Node, name: string, declNode: ts.Identifier): boolean {
    let reassigned = false;
    function visit(node: ts.Node) {
      if (reassigned) return;
      if (ts.isIdentifier(node) && node.text === name && node !== declNode) {
        const parent = node.parent;
        if (ts.isBinaryExpression(parent) && parent.left === node && isAssignmentOperator(parent.operatorToken.kind)) reassigned = true;
        else if ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) && parent.operand === node && isIncDec(parent.operator)) reassigned = true;
      }
      ts.forEachChild(node, visit);
    }
    ts.forEachChild(scopeRoot, visit);
    return reassigned;
  }

  function isAssignmentOperator(kind: ts.SyntaxKind): boolean {
    return (
      kind === ts.SyntaxKind.EqualsToken ||
      kind === ts.SyntaxKind.PlusEqualsToken ||
      kind === ts.SyntaxKind.MinusEqualsToken ||
      kind === ts.SyntaxKind.AsteriskEqualsToken ||
      kind === ts.SyntaxKind.SlashEqualsToken ||
      kind === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
      kind === ts.SyntaxKind.BarBarEqualsToken ||
      kind === ts.SyntaxKind.QuestionQuestionEqualsToken
    );
  }
  function isIncDec(op: ts.PrefixUnaryOperator | ts.PostfixUnaryOperator): boolean {
    return op === ts.SyntaxKind.PlusPlusToken || op === ts.SyntaxKind.MinusMinusToken;
  }

  function visit(node: ts.Node) {
    if (enabled("style.no-var") && ts.isVariableDeclarationList(node) && !(node.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const))) {
      push("style.no-var", "Use of 'var'", "'var' is function-scoped and hoisted, which is a common source of bugs. Use 'let' or 'const' instead.", lineOf(node), lineOf(node, true), "Replace 'var' with 'let' or 'const'.");
    }

    if (enabled("style.no-console") && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "console") {
      push("style.no-console", `console.${node.expression.name.text}(...) left in code`, "A console statement was found - these are usually meant for local debugging and left in by mistake.", lineOf(node), lineOf(node), "Remove the console statement, or route it through the app's logging convention if intentional.");
    }

    if (enabled("style.empty-block") && ts.isBlock(node) && node.statements.length === 0 && !isFunctionBody(node)) {
      push("style.empty-block", "Empty block", "An empty block (if/else/for/while/catch with no body) usually indicates missing logic.", lineOf(node), lineOf(node, true), "Add the intended logic, or a comment explaining why the block is intentionally empty.");
    }

    if (enabled("style.prefer-const") && ts.isVariableDeclarationList(node) && node.flags & ts.NodeFlags.Let) {
      for (const decl of node.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        const scopeRoot = enclosingScope(node);
        if (!checkReassignment(scopeRoot, decl.name.text, decl.name)) {
          push("style.prefer-const", `"${decl.name.text}" is never reassigned`, `"${decl.name.text}" is declared with 'let' but never reassigned - it can be 'const'.`, lineOf(decl), lineOf(decl), "Change 'let' to 'const'.", decl.name.text);
        }
      }
    }

    if (enabled("style.naming-convention")) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        const name = node.name.text;
        const isModuleLevelConst = ts.isVariableDeclarationList(node.parent) && node.parent.flags & ts.NodeFlags.Const && ts.isSourceFile(node.parent.parent.parent);
        const ok = CAMEL_CASE.test(name) || (isModuleLevelConst && UPPER_SNAKE_CASE.test(name));
        if (!ok) {
          push("style.naming-convention", `"${name}" does not follow camelCase`, `Variable "${name}" should be camelCase (or UPPER_SNAKE_CASE for a module-level constant).`, lineOf(node), lineOf(node), "Rename to follow the project's naming convention.", name);
        }
      } else if (ts.isFunctionDeclaration(node) && node.name && !CAMEL_CASE.test(node.name.text)) {
        push("style.naming-convention", `"${node.name.text}" does not follow camelCase`, `Function "${node.name.text}" should be camelCase.`, lineOf(node), lineOf(node), "Rename to follow the project's naming convention.", node.name.text);
      } else if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) && node.name && !PASCAL_CASE.test(node.name.text)) {
        push("style.naming-convention", `"${node.name.text}" does not follow PascalCase`, `"${node.name.text}" should be PascalCase.`, lineOf(node), lineOf(node), "Rename to follow the project's naming convention.", node.name.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  function enclosingScope(node: ts.Node): ts.Node {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (ts.isBlock(current) || ts.isSourceFile(current)) return current;
      current = current.parent;
    }
    return sourceFile;
  }

  visit(sourceFile);
  return { issues, metrics: [{ metricType: "CodingStandard", metricName: "ViolationCount", value: issues.length }] };
}
