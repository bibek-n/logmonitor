import { describe, it, expect } from "vitest";
import { checkContent, checkEmptyBody } from "./contentCheck";

describe("checkContent", () => {
  it("passes with null flags when no rules are configured", () => {
    const result = checkContent("<html>anything</html>", { expectedKeyword: null, forbiddenKeyword: null });
    expect(result).toEqual({ passed: true, expectedKeywordFound: null, forbiddenKeywordFound: null, reason: null });
  });

  it("fails when the required keyword is missing", () => {
    const result = checkContent("<html>hello world</html>", { expectedKeyword: "Welcome", forbiddenKeyword: null });
    expect(result.passed).toBe(false);
    expect(result.expectedKeywordFound).toBe(false);
    expect(result.reason).toMatch(/Welcome/);
  });

  it("passes when the required keyword is present, case-insensitively", () => {
    const result = checkContent("<html>WELCOME to the site</html>", { expectedKeyword: "welcome", forbiddenKeyword: null });
    expect(result.passed).toBe(true);
    expect(result.expectedKeywordFound).toBe(true);
  });

  it("fails when a forbidden keyword is present", () => {
    const result = checkContent("<html>Internal Server Error</html>", { expectedKeyword: null, forbiddenKeyword: "error" });
    expect(result.passed).toBe(false);
    expect(result.forbiddenKeywordFound).toBe(true);
    expect(result.reason).toMatch(/error/i);
  });

  it("checks the forbidden rule only after the required rule already passed", () => {
    const result = checkContent("<html>hello world</html>", { expectedKeyword: "missing", forbiddenKeyword: "world" });
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/missing/);
    expect(result.forbiddenKeywordFound).toBeNull();
  });

  it("passes when both required and forbidden rules are satisfied", () => {
    const result = checkContent("<html>welcome home</html>", { expectedKeyword: "welcome", forbiddenKeyword: "error" });
    expect(result.passed).toBe(true);
    expect(result.expectedKeywordFound).toBe(true);
    expect(result.forbiddenKeywordFound).toBe(false);
  });
});

describe("checkEmptyBody", () => {
  it("flags a whitespace-only body as empty", () => {
    const result = checkEmptyBody("   \n\t  ");
    expect(result?.passed).toBe(false);
    expect(result?.reason).toMatch(/empty/i);
  });

  it("returns null for a non-empty body", () => {
    expect(checkEmptyBody("<html>content</html>")).toBeNull();
  });
});
