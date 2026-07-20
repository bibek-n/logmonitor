import type { AnalyzerIssue, AnalyzerResult, SourceFile } from "./types";
import { extractSnippet } from "./types";

const MODEL_CLASS = /class\s+(\w+)\s+extends\s+(Model|Authenticatable|Pivot|Eloquent)\b/;
const GUARDED_EMPTY = /(?:protected|public)\s+\$guarded\s*=\s*\[\s*\]/;
const HAS_FILLABLE = /\$fillable\s*=/;
const HAS_GUARDED = /\$guarded\s*=/;
const UNFILTERED_ALL = /::create\s*\(\s*(?:request\(\)|\$request)->all\(\)|->update\s*\(\s*(?:request\(\)|\$request)->all\(\)|->fill\s*\(\s*(?:request\(\)|\$request)->all\(\)/;

// Mass assignment: whether a model's $fillable/$guarded correctly restricts which request
// fields Eloquent will assign, plus the common mistake of feeding an entire request payload
// straight into create()/update()/fill() with no filtering at all (bypasses validation for any
// field an attacker adds, even against a well-configured model).
export function analyzeMassAssignment(files: SourceFile[]): AnalyzerResult {
  const issues: AnalyzerIssue[] = [];

  for (const file of files) {
    const classMatch = file.content.match(MODEL_CLASS);
    if (classMatch) {
      const classLineIdx = file.lines.findIndex((l) => l.includes(`class ${classMatch[1]}`));
      const anchorLine = classLineIdx === -1 ? 1 : classLineIdx + 1;

      if (GUARDED_EMPTY.test(file.content)) {
        const guardedLineIdx = file.lines.findIndex((l) => GUARDED_EMPTY.test(l));
        issues.push({
          category: "MassAssignment",
          ruleCode: "massassignment.guarded-empty",
          title: `${classMatch[1]} has $guarded = [] (mass assignment wide open)`,
          description: `${classMatch[1]} sets protected $guarded = [], which tells Eloquent that no attribute is protected - every field in a create()/update() payload can be mass-assigned, including ones the application never intended to expose (e.g. is_admin, role_id).`,
          filePath: file.relativePath,
          startLine: guardedLineIdx === -1 ? anchorLine : guardedLineIdx + 1,
          endLine: guardedLineIdx === -1 ? anchorLine : guardedLineIdx + 1,
          codeElement: classMatch[1],
          severity: "High",
          confidenceLevel: "High",
          recommendation: "Define an explicit $fillable allow-list of the attributes that should be mass-assignable.",
          codeSnippet: extractSnippet(file, guardedLineIdx === -1 ? anchorLine : guardedLineIdx + 1, guardedLineIdx === -1 ? anchorLine : guardedLineIdx + 1),
        });
      } else if (!HAS_FILLABLE.test(file.content) && !HAS_GUARDED.test(file.content)) {
        issues.push({
          category: "MassAssignment",
          ruleCode: "massassignment.fillable-missing",
          title: `${classMatch[1]} defines neither $fillable nor $guarded`,
          description: `${classMatch[1]} extends ${classMatch[2]} but declares neither $fillable nor $guarded, leaving Eloquent's mass-assignment protection undefined for this model.`,
          filePath: file.relativePath,
          startLine: anchorLine,
          endLine: anchorLine,
          codeElement: classMatch[1],
          severity: "Medium",
          confidenceLevel: "Medium",
          recommendation: "Add an explicit $fillable (preferred) or $guarded property.",
          codeSnippet: extractSnippet(file, anchorLine, anchorLine),
        });
      }
    }

    file.lines.forEach((line, idx) => {
      if (UNFILTERED_ALL.test(line)) {
        issues.push({
          category: "MassAssignment",
          ruleCode: "massassignment.request-all",
          title: "Unfiltered request()->all() passed to create/update/fill",
          description: "The entire request payload is passed directly to create()/update()/fill() with no validation or field filtering - even a well-configured model's $fillable list only limits which fields can be set, it doesn't validate their content, so this still skips all business-rule validation.",
          filePath: file.relativePath,
          startLine: idx + 1,
          endLine: idx + 1,
          severity: "Medium",
          confidenceLevel: "Medium",
          recommendation: "Validate input first (e.g. $request->validate([...]) or a Form Request) and pass the validated array, not the raw request, to create()/update()/fill().",
          codeSnippet: extractSnippet(file, idx + 1, idx + 1),
        });
      }
    });
  }

  return { issues };
}
