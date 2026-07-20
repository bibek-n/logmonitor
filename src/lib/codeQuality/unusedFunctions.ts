import ts from "typescript";
import type { AnalyzerIssue, AnalyzerResult, SourceFile } from "./types";
import { extractSnippet } from "./types";

interface DeclaredFunction {
  name: string;
  nameNode: ts.Identifier;
  startLine: number;
  endLine: number;
  isExported: boolean;
}

function scriptKindFor(relativePath: string): ts.ScriptKind {
  if (relativePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (relativePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (relativePath.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function hasDefaultModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
}

// Only module-level function declarations / const-assigned function expressions are
// collected - class methods are deliberately out of scope (tracking "is this method ever
// called on some instance" needs real type information to do reliably; a text search would
// produce too many false positives from unrelated same-named methods on other classes).
function collectDeclaredFunctions(sourceFile: ts.SourceFile): DeclaredFunction[] {
  const declared: DeclaredFunction[] = [];

  function lineOf(node: ts.Node, useEnd = false): number {
    return sourceFile.getLineAndCharacterOfPosition(useEnd ? node.end : node.getStart(sourceFile)).line + 1;
  }

  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      // Default-exported functions can be imported under any local alias, so cross-file
      // usage can't be matched reliably by name - skip rather than risk false positives.
      if (hasDefaultModifier(stmt)) continue;
      declared.push({ name: stmt.name.text, nameNode: stmt.name, startLine: lineOf(stmt), endLine: lineOf(stmt, true), isExported: hasExportModifier(stmt) });
    } else if (ts.isVariableStatement(stmt)) {
      const isExported = hasExportModifier(stmt);
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        if (!ts.isArrowFunction(decl.initializer) && !ts.isFunctionExpression(decl.initializer)) continue;
        declared.push({ name: decl.name.text, nameNode: decl.name, startLine: lineOf(stmt), endLine: lineOf(stmt, true), isExported });
      }
    }
  }

  return declared;
}

function countIdentifierReferences(root: ts.Node, name: string, excludeNode: ts.Identifier): number {
  let count = 0;
  function visit(node: ts.Node) {
    if (ts.isIdentifier(node) && node.text === name && node !== excludeNode) {
      const parent = node.parent;
      const isDeclarationName =
        (ts.isFunctionDeclaration(parent) && parent.name === node) ||
        (ts.isVariableDeclaration(parent) && parent.name === node) ||
        (ts.isPropertyAccessExpression(parent) && parent.name === node);
      if (!isDeclarationName) count++;
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(root, visit);
  return count;
}

// Named imports project-wide, keyed by imported name -> importing file paths. Used to check
// whether an exported function is ever imported anywhere else in the scanned set. Text-based
// (matches on the imported identifier's name, not a resolved module graph), so it's a
// deliberately Medium-confidence signal, not a certainty - re-exports and dynamic import()
// calls aren't tracked.
function collectImportedNames(files: SourceFile[]): Set<string> {
  const imported = new Set<string>();
  for (const file of files) {
    const sourceFile = ts.createSourceFile(file.relativePath, file.content, ts.ScriptTarget.Latest, true, scriptKindFor(file.relativePath));
    for (const stmt of sourceFile.statements) {
      if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
      const namedBindings = stmt.importClause.namedBindings;
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const spec of namedBindings.elements) {
          imported.add((spec.propertyName ?? spec.name).text);
        }
      }
    }
  }
  return imported;
}

export function analyzeUnusedFunctions(files: SourceFile[]): AnalyzerResult {
  const issues: AnalyzerIssue[] = [];
  const importedNamesProjectWide = collectImportedNames(files);

  for (const file of files) {
    const sourceFile = ts.createSourceFile(file.relativePath, file.content, ts.ScriptTarget.Latest, true, scriptKindFor(file.relativePath));
    const declared = collectDeclaredFunctions(sourceFile);

    for (const fn of declared) {
      if (fn.name.startsWith("_")) continue;

      if (fn.isExported) {
        if (importedNamesProjectWide.has(fn.name)) continue;
        // Still might be used elsewhere in the same file (e.g. exported for tests but also
        // called locally) - only flag if truly unreferenced anywhere we can see.
        if (countIdentifierReferences(sourceFile, fn.name, fn.nameNode) > 0) continue;

        issues.push({
          category: "UnusedFunction",
          ruleCode: "unused.function",
          title: `Unused exported function "${fn.name}"`,
          description: `"${fn.name}" is exported but never imported by name anywhere else in the scanned project, and never called within this file.`,
          filePath: file.relativePath,
          startLine: fn.startLine,
          endLine: fn.endLine,
          codeElement: fn.name,
          severity: "Low",
          confidenceLevel: "Medium",
          recommendation: "Remove this export if it's genuinely unused, or confirm it's consumed outside the scanned project (e.g. a published package entry point).",
          codeSnippet: extractSnippet(file, fn.startLine, fn.startLine),
        });
      } else {
        const referenceCount = countIdentifierReferences(sourceFile, fn.name, fn.nameNode);
        if (referenceCount > 0) continue;

        issues.push({
          category: "UnusedFunction",
          ruleCode: "unused.function",
          title: `Unused function "${fn.name}"`,
          description: `"${fn.name}" is declared but never called within this file, and is not exported.`,
          filePath: file.relativePath,
          startLine: fn.startLine,
          endLine: fn.endLine,
          codeElement: fn.name,
          severity: "Low",
          confidenceLevel: "High",
          recommendation: "Remove the unused function.",
          codeSnippet: extractSnippet(file, fn.startLine, fn.startLine),
        });
      }
    }
  }

  return { issues, metrics: [{ metricType: "UnusedFunction", metricName: "UnusedFunctionCount", value: issues.length }] };
}
