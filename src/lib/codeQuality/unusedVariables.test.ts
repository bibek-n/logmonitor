import { describe, it, expect } from "vitest";
import { analyzeUnusedVariables } from "./unusedVariables";
import { makeSourceFile } from "./testHelpers";

describe("analyzeUnusedVariables", () => {
  it("flags a declared-but-never-read local variable", () => {
    const file = makeSourceFile("f.ts", `function f() {\n  const unused = 1;\n  return 2;\n}\n`);
    const { issues } = analyzeUnusedVariables(file);
    expect(issues).toHaveLength(1);
    expect(issues[0].codeElement).toBe("unused");
    expect(issues[0].ruleCode).toBe("unused.variable");
  });

  it("does not flag a variable that is read later in the same scope", () => {
    const file = makeSourceFile("f.ts", `function f() {\n  const used = 1;\n  return used + 1;\n}\n`);
    expect(analyzeUnusedVariables(file).issues).toHaveLength(0);
  });

  it("flags an unused function parameter", () => {
    const file = makeSourceFile("f.ts", `function f(a, b) {\n  return a;\n}\n`);
    const { issues } = analyzeUnusedVariables(file);
    expect(issues).toHaveLength(1);
    expect(issues[0].codeElement).toBe("b");
    expect(issues[0].title).toContain("parameter");
  });

  it("does not flag a parameter prefixed with an underscore", () => {
    const file = makeSourceFile("f.ts", `function f(a, _b) {\n  return a;\n}\n`);
    expect(analyzeUnusedVariables(file).issues).toHaveLength(0);
  });

  it("does not flag a variable prefixed with an underscore", () => {
    const file = makeSourceFile("f.ts", `function f() {\n  const _skip = 1;\n  return 2;\n}\n`);
    expect(analyzeUnusedVariables(file).issues).toHaveLength(0);
  });

  it("does not treat a property access with the same name as a usage", () => {
    const file = makeSourceFile("f.ts", `function f(obj) {\n  const name = 1;\n  return obj.name;\n}\n`);
    const { issues } = analyzeUnusedVariables(file);
    expect(issues.some((i) => i.codeElement === "name")).toBe(true);
  });

  it("destructures object and array binding patterns into individual declarations", () => {
    const file = makeSourceFile("f.ts", `function f(obj, arr) {\n  const { used, unused } = obj;\n  const [a, b] = arr;\n  return used + a;\n}\n`);
    const { issues } = analyzeUnusedVariables(file);
    const names = issues.map((i) => i.codeElement).sort();
    expect(names).toEqual(["b", "unused"]);
  });

  it("does not flag a module-level const that is used elsewhere in the file", () => {
    const file = makeSourceFile("f.ts", `const CONFIG = { max: 10 };\nfunction f() {\n  return CONFIG.max;\n}\n`);
    expect(analyzeUnusedVariables(file).issues).toHaveLength(0);
  });
});
