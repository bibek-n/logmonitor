import { describe, it, expect } from "vitest";
import { evaluateAssertions } from "./apiAssertions";
import { ApiAssertion } from "./types";

function assertion(partial: Partial<ApiAssertion>): ApiAssertion {
  return { path: "status", operator: "equals", expectedValue: null, ...partial };
}

describe("evaluateAssertions", () => {
  it("returns an empty array when no assertions are configured", () => {
    expect(evaluateAssertions('{"status":"ok"}', [])).toEqual([]);
  });

  it("fails every assertion with the same reason when the body isn't valid JSON", () => {
    const results = evaluateAssertions("not json", [assertion({ path: "status", operator: "equals", expectedValue: "ok" })]);
    expect(results[0].passed).toBe(false);
    expect(results[0].reason).toMatch(/not valid JSON/);
  });

  it("passes an equals assertion on a matching value", () => {
    const results = evaluateAssertions('{"status":"ok"}', [assertion({ path: "status", operator: "equals", expectedValue: "ok" })]);
    expect(results[0].passed).toBe(true);
    expect(results[0].actualValue).toBe("ok");
  });

  it("fails an equals assertion on a mismatched value", () => {
    const results = evaluateAssertions('{"status":"down"}', [assertion({ path: "status", operator: "equals", expectedValue: "ok" })]);
    expect(results[0].passed).toBe(false);
  });

  it("resolves a nested array path for contains", () => {
    const body = JSON.stringify({ data: { items: [{ id: 1 }, { id: 2 }] } });
    const results = evaluateAssertions(body, [assertion({ path: "data.items[1].id", operator: "equals", expectedValue: "2" })]);
    expect(results[0].passed).toBe(true);
  });

  it("exists passes when the path resolves, notExists passes when it doesn't", () => {
    const body = JSON.stringify({ status: "ok" });
    expect(evaluateAssertions(body, [assertion({ path: "status", operator: "exists" })])[0].passed).toBe(true);
    expect(evaluateAssertions(body, [assertion({ path: "missing", operator: "exists" })])[0].passed).toBe(false);
    expect(evaluateAssertions(body, [assertion({ path: "missing", operator: "notExists" })])[0].passed).toBe(true);
  });

  it("evaluates greaterThan/lessThan numerically", () => {
    const body = JSON.stringify({ count: 5 });
    expect(evaluateAssertions(body, [assertion({ path: "count", operator: "greaterThan", expectedValue: "3" })])[0].passed).toBe(true);
    expect(evaluateAssertions(body, [assertion({ path: "count", operator: "lessThan", expectedValue: "3" })])[0].passed).toBe(false);
  });

  it("evaluates matchesRegex and reports an invalid pattern as a failure", () => {
    const body = JSON.stringify({ version: "v1.2.3" });
    expect(evaluateAssertions(body, [assertion({ path: "version", operator: "matchesRegex", expectedValue: "^v\\d+\\.\\d+\\.\\d+$" })])[0].passed).toBe(true);
    const bad = evaluateAssertions(body, [assertion({ path: "version", operator: "matchesRegex", expectedValue: "(" })]);
    expect(bad[0].passed).toBe(false);
    expect(bad[0].reason).toMatch(/not a valid regular expression/);
  });

  it("evaluates multiple assertions independently", () => {
    const body = JSON.stringify({ status: "ok", count: 5 });
    const results = evaluateAssertions(body, [
      assertion({ path: "status", operator: "equals", expectedValue: "ok" }),
      assertion({ path: "count", operator: "greaterThan", expectedValue: "10" }),
    ]);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(false);
  });
});
