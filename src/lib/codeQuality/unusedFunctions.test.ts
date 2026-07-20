import { describe, it, expect } from "vitest";
import { analyzeUnusedFunctions } from "./unusedFunctions";
import { makeSourceFile } from "./testHelpers";

describe("analyzeUnusedFunctions", () => {
  it("flags a non-exported function that is never called in its file", () => {
    const file = makeSourceFile("f.ts", `function helper() {\n  return 1;\n}\n`);
    const { issues } = analyzeUnusedFunctions([file]);
    expect(issues).toHaveLength(1);
    expect(issues[0].codeElement).toBe("helper");
    expect(issues[0].title).toContain("Unused function");
  });

  it("does not flag a non-exported function that is called locally", () => {
    const file = makeSourceFile("f.ts", `function helper() {\n  return 1;\n}\nconst x = helper();\n`);
    expect(analyzeUnusedFunctions([file]).issues).toHaveLength(0);
  });

  it("flags an exported function never imported anywhere in the scanned set", () => {
    const file = makeSourceFile("f.ts", `export function unusedExport() {\n  return 1;\n}\n`);
    const { issues } = analyzeUnusedFunctions([file]);
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toContain("Unused exported function");
  });

  it("does not flag an exported function that is imported by name in another scanned file", () => {
    const a = makeSourceFile("a.ts", `export function shared() {\n  return 1;\n}\n`);
    const b = makeSourceFile("b.ts", `import { shared } from "./a";\nshared();\n`);
    const { issues } = analyzeUnusedFunctions([a, b]);
    expect(issues.some((i) => i.codeElement === "shared")).toBe(false);
  });

  it("does not flag a default-exported function (cannot be matched by name across files)", () => {
    const file = makeSourceFile("f.ts", `export default function main() {\n  return 1;\n}\n`);
    expect(analyzeUnusedFunctions([file]).issues).toHaveLength(0);
  });

  it("recognizes a const-assigned arrow/function expression as a declared function", () => {
    const file = makeSourceFile("f.ts", `const helper = () => {\n  return 1;\n};\n`);
    const { issues } = analyzeUnusedFunctions([file]);
    expect(issues).toHaveLength(1);
    expect(issues[0].codeElement).toBe("helper");
  });

  it("does not flag a function prefixed with an underscore", () => {
    const file = makeSourceFile("f.ts", `function _internal() {\n  return 1;\n}\n`);
    expect(analyzeUnusedFunctions([file]).issues).toHaveLength(0);
  });
});
