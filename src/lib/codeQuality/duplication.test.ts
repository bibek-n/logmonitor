import { describe, it, expect } from "vitest";
import { analyzeDuplication } from "./duplication";
import { makeSourceFile, makeSettings } from "./testHelpers";

describe("analyzeDuplication", () => {
  it("finds no duplication across files with entirely unique content", () => {
    const fileA = makeSourceFile("a.ts", "const x = 1;\nconst y = 2;\nconst z = 3;\n");
    const fileB = makeSourceFile("b.ts", "const p = 4;\nconst q = 5;\nconst r = 6;\n");
    const { blocks, duplicatedLineCount } = analyzeDuplication([fileA, fileB], makeSettings());
    expect(blocks).toHaveLength(0);
    expect(duplicatedLineCount).toBe(0);
  });

  it("does not flag a matching run shorter than minDuplicateBlockSize", () => {
    const fileA = makeSourceFile("a.ts", "const uniqueA1 = 1;\ndoThing1();\ndoThing2();\ndoThing3();\nconst uniqueA2 = 2;\n");
    const fileB = makeSourceFile("b.ts", "const uniqueB1 = 3;\ndoThing1();\ndoThing2();\ndoThing3();\nconst uniqueB2 = 4;\n");
    const { blocks } = analyzeDuplication([fileA, fileB], makeSettings()); // minDuplicateBlockSize is 6
    expect(blocks).toHaveLength(0);
  });

  it("detects an exact-length duplicated block across two files and stops extending at the boundary", () => {
    const fileA = makeSourceFile(
      "a.ts",
      ["const uniqueA1 = 111;", "const uniqueA2 = 222;", "doThing1();", "doThing2();", "doThing3();", "doThing4();", "doThing5();", "doThing6();", "const uniqueA3 = 333;", "const uniqueA4 = 444;"].join("\n")
    );
    const fileB = makeSourceFile(
      "b.ts",
      ["const uniqueB1 = 555;", "doThing1();", "doThing2();", "doThing3();", "doThing4();", "doThing5();", "doThing6();", "const uniqueB2 = 666;", "const uniqueB3 = 777;"].join("\n")
    );
    const settings = makeSettings();
    const { blocks, duplicatedLineCount, totalSignificantLineCount, result } = analyzeDuplication([fileA, fileB], settings);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].lineCount).toBe(6);
    expect(blocks[0].sourceFile).toBe("a.ts");
    expect(blocks[0].matchingFile).toBe("b.ts");
    expect(blocks[0].similarityPercent).toBe(100);
    expect(duplicatedLineCount).toBe(12); // 6 lines consumed in each file
    expect(totalSignificantLineCount).toBe(19); // 10 significant lines in a.ts + 9 in b.ts

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe("Low"); // 6 lines, below block*2 (12)
    expect(result.issues[0].ruleCode).toBe("duplication.block");

    const percentMetric = result.metrics.find((m) => m.metricName === "DuplicationPercent");
    expect(percentMetric?.value).toBeCloseTo((12 / 19) * 100, 1);
  });

  it("excludes blank lines, comments, and bare-punctuation lines from the duplication window", () => {
    const shared = ["doThing1();", "doThing2();", "doThing3();", "doThing4();", "doThing5();", "doThing6();"];
    const fileA = makeSourceFile("a.ts", ["// header comment", "", "{", ...shared, "}", ""].join("\n"));
    const fileB = makeSourceFile("b.ts", ["/* other comment */", ...shared, ";"].join("\n"));
    const { blocks } = analyzeDuplication([fileA, fileB], makeSettings());
    expect(blocks).toHaveLength(1);
    expect(blocks[0].lineCount).toBe(6);
  });

  it("assigns increasing severity bands as the duplicated block grows relative to minDuplicateBlockSize", () => {
    const settings = makeSettings({ minDuplicateBlockSize: 2 });
    const lines = Array.from({ length: 12 }, (_, i) => `doThing${i}();`);
    const fileA = makeSourceFile("a.ts", lines.join("\n"));
    const fileB = makeSourceFile("b.ts", lines.join("\n"));
    const { result } = analyzeDuplication([fileA, fileB], settings);
    // block(2)*5 = 10 <= 12-line match => Critical
    expect(result.issues[0].severity).toBe("Critical");
  });
});
