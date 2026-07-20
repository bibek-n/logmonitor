import ts from "typescript";
import type { AnalyzerIssue, AnalyzerResult, SourceFile } from "./types";
import { extractSnippet } from "./types";

interface DeclaredVariable {
  name: string;
  nameNode: ts.Identifier;
  scopeNode: ts.Node;
  scope: "Module" | "Local" | "Parameter";
  declarationKind: "var" | "let" | "const" | "parameter";
}

function scriptKindFor(relativePath: string): ts.ScriptKind {
  if (relativePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (relativePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (relativePath.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
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

function enclosingFunctionOrFile(node: ts.Node, sourceFile: ts.SourceFile): ts.Node {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (FUNCTION_LIKE_KINDS.has(current.kind)) return current;
    current = current.parent;
  }
  return sourceFile;
}

// Distinguishes an Identifier that's a genuine *reference* to a variable from one that's
// really a property/label/import-alias name that just happens to share the same text - a
// bare "obj.foo" walk would otherwise count every ".foo" property access anywhere as a
// reference to a local variable named "foo".
function isReferenceIdentifier(id: ts.Identifier): boolean {
  const parent = id.parent;
  if (!parent) return true;
  if (ts.isPropertyAccessExpression(parent) && parent.name === id) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === id) return false;
  if (ts.isPropertySignature(parent) && parent.name === id) return false;
  if ((ts.isMethodDeclaration(parent) || ts.isMethodSignature(parent)) && parent.name === id) return false;
  if (ts.isImportSpecifier(parent) && parent.propertyName === id) return false;
  if (ts.isExportSpecifier(parent) && parent.propertyName === id) return false;
  if (ts.isLabeledStatement(parent) && parent.label === id) return false;
  if ((ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === id) return false;
  return true;
}

// Documented heuristic, not a full binder: a declaration is "used" if its name appears as a
// reference identifier anywhere in its enclosing function (or the whole file, for top-level
// declarations) other than the declaration itself. This does not model shadowing correctly -
// a differently-scoped variable with the same name can make an unused one look "used." Known
// limitation, chosen over hand-rolling a full scope resolver for a first version.
function countReferences(scopeNode: ts.Node, name: string, declarationNameNode: ts.Identifier, sourceFile: ts.SourceFile): number {
  let count = 0;
  function visit(node: ts.Node) {
    if (ts.isIdentifier(node) && node.text === name && node !== declarationNameNode && isReferenceIdentifier(node)) {
      count++;
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(scopeNode, visit);
  return count;
}

function collectDeclarations(sourceFile: ts.SourceFile): DeclaredVariable[] {
  const declared: DeclaredVariable[] = [];

  function addBindingNames(name: ts.BindingName, declarationKind: DeclaredVariable["declarationKind"], scopeNode: ts.Node, scope: DeclaredVariable["scope"]) {
    if (ts.isIdentifier(name)) {
      declared.push({ name: name.text, nameNode: name, scopeNode, scope, declarationKind });
    } else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) {
        if (ts.isOmittedExpression(element)) continue;
        addBindingNames(element.name, declarationKind, scopeNode, scope);
      }
    }
  }

  function visit(node: ts.Node) {
    // A catch clause's binding ("catch (e)") is a lone VariableDeclaration, never wrapped in
    // a VariableDeclarationList, so it never matches here - catch bindings are intentionally
    // excluded (an unused caught error is extremely common and rarely worth flagging).
    if (ts.isVariableDeclarationList(node)) {
      const kind: DeclaredVariable["declarationKind"] = node.flags & ts.NodeFlags.Const ? "const" : node.flags & ts.NodeFlags.Let ? "let" : "var";
      const scopeNode = enclosingFunctionOrFile(node, sourceFile);
      const scope: DeclaredVariable["scope"] = scopeNode === sourceFile ? "Module" : "Local";
      for (const decl of node.declarations) addBindingNames(decl.name, kind, scopeNode, scope);
    }
    if (isFunctionLikeWithParams(node)) {
      for (const param of node.parameters) {
        if (ts.isIdentifier(param.name) && !param.name.text.startsWith("_") && !param.dotDotDotToken) {
          declared.push({ name: param.name.text, nameNode: param.name, scopeNode: node, scope: "Parameter", declarationKind: "parameter" });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  function isFunctionLikeWithParams(node: ts.Node): node is ts.FunctionLikeDeclaration {
    return FUNCTION_LIKE_KINDS.has(node.kind) && "parameters" in node;
  }

  visit(sourceFile);
  return declared;
}

export function analyzeUnusedVariables(file: SourceFile): AnalyzerResult {
  const issues: AnalyzerIssue[] = [];
  const sourceFile = ts.createSourceFile(file.relativePath, file.content, ts.ScriptTarget.Latest, true, scriptKindFor(file.relativePath));
  const declarations = collectDeclarations(sourceFile);

  for (const decl of declarations) {
    if (decl.name.startsWith("_")) continue; // conventional "intentionally unused" marker
    const referenceCount = countReferences(decl.scopeNode, decl.name, decl.nameNode, sourceFile);
    if (referenceCount > 0) continue;

    const line = sourceFile.getLineAndCharacterOfPosition(decl.nameNode.getStart(sourceFile)).line + 1;
    issues.push({
      category: "UnusedVariable",
      ruleCode: "unused.variable",
      title: `Unused ${decl.declarationKind === "parameter" ? "parameter" : "variable"} "${decl.name}"`,
      description: `"${decl.name}" is declared but never read within its scope.`,
      filePath: file.relativePath,
      startLine: line,
      endLine: line,
      codeElement: decl.name,
      severity: "Low",
      confidenceLevel: "Medium",
      recommendation: decl.declarationKind === "parameter"
        ? `Remove the unused parameter, or prefix it with an underscore (_${decl.name}) if it must stay for signature compatibility.`
        : "Remove the unused declaration.",
      codeSnippet: extractSnippet(file, line, line),
    });
  }

  return { issues, metrics: [{ metricType: "UnusedVariable", metricName: "UnusedVariableCount", value: issues.length }] };
}
