import { describe, it, expect } from "vitest";
import { analyzeDeadCode } from "./deadCode";
import { makeSourceFile } from "./testHelpers";

describe("analyzeDeadCode", () => {
  it("finds no issues in code with no early exits", () => {
    const file = makeSourceFile("clean.ts", `function f(a) {\n  const x = a + 1;\n  console.log(x);\n}\n`);
    const { issues } = analyzeDeadCode(file);
    expect(issues).toHaveLength(0);
  });

  it("flags a statement that follows a return in the same block", () => {
    const file = makeSourceFile("dead.ts", `function f() {\n  return 1;\n  console.log("never runs");\n}\n`);
    const { issues } = analyzeDeadCode(file);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleCode).toBe("deadcode.unreachable");
    expect(issues[0].category).toBe("DeadCode");
  });

  it("flags code following throw/break/continue as well as return", () => {
    const throwFile = makeSourceFile("t.ts", `function f() {\n  throw new Error("x");\n  const y = 1;\n}\n`);
    expect(analyzeDeadCode(throwFile).issues).toHaveLength(1);

    const breakFile = makeSourceFile("b.ts", `function f() {\n  for (;;) {\n    break;\n    const y = 1;\n  }\n}\n`);
    expect(analyzeDeadCode(breakFile).issues).toHaveLength(1);

    const continueFile = makeSourceFile("c.ts", `function f() {\n  for (;;) {\n    continue;\n    const y = 1;\n  }\n}\n`);
    expect(analyzeDeadCode(continueFile).issues).toHaveLength(1);
  });

  it("does not flag a function/class declaration that follows a return (hoisting)", () => {
    const file = makeSourceFile("hoist.ts", `function f() {\n  return 1;\n  function helper() { return 2; }\n}\n`);
    const { issues } = analyzeDeadCode(file);
    expect(issues).toHaveLength(0);
  });

  it("resumes flagging after a hoisted declaration breaks the unreachable run", () => {
    const file = makeSourceFile("resume.ts", `function f() {\n  return 1;\n  function helper() { return 2; }\n  console.log("also dead");\n}\n`);
    const { issues } = analyzeDeadCode(file);
    expect(issues).toHaveLength(1);
  });

  it("treats a switch case clause as its own statement list", () => {
    const file = makeSourceFile("switch.ts", `function f(a) {\n  switch (a) {\n    case 1:\n      return 1;\n      console.log("dead");\n  }\n}\n`);
    const { issues } = analyzeDeadCode(file);
    expect(issues).toHaveLength(1);
  });

  it("does not flag the code after an if/else where only one branch terminates (known limitation)", () => {
    const file = makeSourceFile("partial.ts", `function f(a) {\n  if (a) {\n    return 1;\n  } else {\n    doSomething();\n  }\n  console.log("reachable via else");\n}\n`);
    const { issues } = analyzeDeadCode(file);
    expect(issues).toHaveLength(0);
  });
});
