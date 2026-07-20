import { describe, it, expect } from "vitest";
import { analyzeComplexity, summarizeComplexityMetrics } from "./complexity";
import { makeSourceFile, makeSettings } from "./testHelpers";

describe("analyzeComplexity", () => {
  it("reports complexity 1 for a straight-line function and does not flag it", () => {
    const file = makeSourceFile("straight.ts", `function f() {\n  return 1;\n}\n`);
    const { issues, metrics } = analyzeComplexity(file, makeSettings());
    expect(issues).toHaveLength(0);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].value).toBe(1);
  });

  it("increments complexity once per if/for/while/&&/||/case", () => {
    const file = makeSourceFile("branchy.ts", `
      function f(a, b, c) {
        if (a) { return 1; }
        for (let i = 0; i < 10; i++) { }
        while (b) { }
        if (a && b) { }
        if (a || c) { }
        switch (a) {
          case 1: break;
          case 2: break;
          default: break;
        }
      }
    `);
    const { metrics } = analyzeComplexity(file, makeSettings());
    // base 1 + if + for + while + (if + &&) + (if + ||) + 2 case clauses (default excluded) = 10
    expect(metrics[0].value).toBe(10);
  });

  it("does not let a nested function's branches inflate the parent's complexity", () => {
    const file = makeSourceFile("nested.ts", `
      function outer() {
        const inner = () => { if (true) { return 1; } };
        return inner();
      }
    `);
    const { metrics } = analyzeComplexity(file, makeSettings());
    const outer = metrics.find((m) => m.metricName === "outer");
    const inner = metrics.find((m) => m.metricName === "inner");
    expect(outer?.value).toBe(1);
    expect(inner?.value).toBe(2);
  });

  it("flags a function above complexityLowMax as an issue with the right severity band", () => {
    const branches = Array.from({ length: 8 }, (_, i) => `if (a === ${i}) { b++; }`).join("\n");
    const file = makeSourceFile("complex.ts", `function f(a, b) {\n${branches}\n}\n`);
    const settings = makeSettings();
    const { issues } = analyzeComplexity(file, settings);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("Medium"); // complexity 9, within (5, 10]
    expect(issues[0].ruleCode).toBe("complexity.function-threshold");
    expect(issues[0].codeElement).toBe("f");
  });

  it("escalates severity through High and Critical bands as complexity grows", () => {
    const settings = makeSettings();
    const highBranches = Array.from({ length: 14 }, (_, i) => `if (a === ${i}) { b++; }`).join("\n");
    const high = analyzeComplexity(makeSourceFile("high.ts", `function f(a, b) {\n${highBranches}\n}\n`), settings);
    expect(high.issues[0].severity).toBe("High"); // complexity 15, within (10, 20]

    const criticalBranches = Array.from({ length: 25 }, (_, i) => `if (a === ${i}) { b++; }`).join("\n");
    const critical = analyzeComplexity(makeSourceFile("critical.ts", `function f(a, b) {\n${criticalBranches}\n}\n`), settings);
    expect(critical.issues[0].severity).toBe("Critical"); // complexity 26, above 20
  });

  it("names an anonymous const-assigned arrow function after its variable", () => {
    const file = makeSourceFile("named.ts", `const handleClick = () => { return 1; };\n`);
    const { metrics } = analyzeComplexity(file, makeSettings());
    expect(metrics[0].metricName).toBe("handleClick");
  });
});

describe("summarizeComplexityMetrics", () => {
  it("returns zeroed summary for an empty list", () => {
    expect(summarizeComplexityMetrics([])).toEqual({ average: 0, max: 0, functionsAboveThreshold: 0 });
  });

  it("computes average, max, and above-threshold count", () => {
    const metrics = [
      { metricType: "Complexity", metricName: "a", value: 2, threshold: 5 },
      { metricType: "Complexity", metricName: "b", value: 8, threshold: 5 },
      { metricType: "Complexity", metricName: "c", value: 11, threshold: 5 },
    ];
    const summary = summarizeComplexityMetrics(metrics);
    expect(summary.average).toBe(7);
    expect(summary.max).toBe(11);
    expect(summary.functionsAboveThreshold).toBe(2);
  });
});
