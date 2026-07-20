import { describe, it, expect } from "vitest";
import { analyzeCodingStandards } from "./codingStandards";
import { makeSourceFile, makeSettings } from "./testHelpers";

function only(ruleCode: string) {
  return makeSettings({ enabledRuleCodes: new Set([ruleCode]) });
}

describe("analyzeCodingStandards", () => {
  it("flags a line longer than maxLineLength", () => {
    const longLine = `const x = "${"a".repeat(130)}";`;
    const file = makeSourceFile("f.ts", longLine);
    const { issues } = analyzeCodingStandards(file, only("style.max-line-length"));
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleCode).toBe("style.max-line-length");
  });

  it("does not flag a line at or under maxLineLength", () => {
    const file = makeSourceFile("f.ts", `const x = 1;`);
    expect(analyzeCodingStandards(file, only("style.max-line-length")).issues).toHaveLength(0);
  });

  it("flags use of var", () => {
    const file = makeSourceFile("f.ts", `var x = 1;\n`);
    const { issues } = analyzeCodingStandards(file, only("style.no-var"));
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleCode).toBe("style.no-var");
  });

  it("does not flag let/const", () => {
    const file = makeSourceFile("f.ts", `let x = 1;\nconst y = 2;\n`);
    expect(analyzeCodingStandards(file, only("style.no-var")).issues).toHaveLength(0);
  });

  it("flags a console statement", () => {
    const file = makeSourceFile("f.ts", `console.log("debug");\n`);
    const { issues } = analyzeCodingStandards(file, only("style.no-console"));
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toContain("console.log");
  });

  it("flags an empty non-function block but not an empty function body", () => {
    const file = makeSourceFile("f.ts", `function f() {\n}\nif (true) {\n}\n`);
    const { issues } = analyzeCodingStandards(file, only("style.empty-block"));
    expect(issues).toHaveLength(1); // only the if-block, not the function body
  });

  it("flags a let that is never reassigned", () => {
    const file = makeSourceFile("f.ts", `function f() {\n  let x = 1;\n  return x;\n}\n`);
    const { issues } = analyzeCodingStandards(file, only("style.prefer-const"));
    expect(issues).toHaveLength(1);
    expect(issues[0].codeElement).toBe("x");
  });

  it("does not flag a let that is reassigned", () => {
    const file = makeSourceFile("f.ts", `function f() {\n  let x = 1;\n  x = 2;\n  return x;\n}\n`);
    expect(analyzeCodingStandards(file, only("style.prefer-const")).issues).toHaveLength(0);
  });

  it("does not flag a let that is incremented", () => {
    const file = makeSourceFile("f.ts", `function f() {\n  let x = 1;\n  x++;\n  return x;\n}\n`);
    expect(analyzeCodingStandards(file, only("style.prefer-const")).issues).toHaveLength(0);
  });

  it("flags a non-camelCase variable name", () => {
    const file = makeSourceFile("f.ts", `function f() {\n  let BadName = 1;\n  return BadName;\n}\n`);
    const { issues } = analyzeCodingStandards(file, only("style.naming-convention"));
    expect(issues.some((i) => i.codeElement === "BadName")).toBe(true);
  });

  it("allows UPPER_SNAKE_CASE only for a module-level const", () => {
    const file = makeSourceFile("f.ts", `const MAX_RETRIES = 3;\n`);
    const { issues } = analyzeCodingStandards(file, only("style.naming-convention"));
    expect(issues.some((i) => i.codeElement === "MAX_RETRIES")).toBe(false);
  });

  it("flags a non-camelCase function name", () => {
    const file = makeSourceFile("f.ts", `function Bad_Function() {\n  return 1;\n}\n`);
    const { issues } = analyzeCodingStandards(file, only("style.naming-convention"));
    expect(issues.some((i) => i.codeElement === "Bad_Function")).toBe(true);
  });

  it("flags a non-PascalCase class name", () => {
    const file = makeSourceFile("f.ts", `class badClass {}\n`);
    const { issues } = analyzeCodingStandards(file, only("style.naming-convention"));
    expect(issues.some((i) => i.codeElement === "badClass")).toBe(true);
  });

  it("respects enabledRuleCodes and skips a disabled rule", () => {
    const file = makeSourceFile("f.ts", `var x = 1;\n`);
    const { issues } = analyzeCodingStandards(file, only("style.no-console")); // no-var not enabled
    expect(issues).toHaveLength(0);
  });

  it("treats an empty enabledRuleCodes set as 'all rules enabled'", () => {
    const file = makeSourceFile("f.ts", `var x = 1;\n`);
    const settings = makeSettings({ enabledRuleCodes: new Set() });
    const { issues } = analyzeCodingStandards(file, settings);
    expect(issues.some((i) => i.ruleCode === "style.no-var")).toBe(true);
  });
});
