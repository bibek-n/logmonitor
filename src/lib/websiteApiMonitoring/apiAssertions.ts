import { resolveJsonPath } from "./jsonPath";
import { ApiAssertion, ApiAssertionResult } from "./types";

function stringifyActual(value: unknown): string | null {
  if (value === undefined) return null;
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function evaluateOne(actualValue: unknown, assertion: ApiAssertion): { passed: boolean; reason: string | null } {
  const actualStr = stringifyActual(actualValue);
  const expected = assertion.expectedValue ?? "";

  switch (assertion.operator) {
    case "exists":
      return actualValue !== undefined ? { passed: true, reason: null } : { passed: false, reason: `No value found at "${assertion.path}".` };
    case "notExists":
      return actualValue === undefined ? { passed: true, reason: null } : { passed: false, reason: `Expected no value at "${assertion.path}", but found ${actualStr}.` };
    case "equals":
      return actualStr === expected ? { passed: true, reason: null } : { passed: false, reason: `Expected "${assertion.path}" to equal "${expected}", got ${actualStr ?? "undefined"}.` };
    case "notEquals":
      return actualStr !== expected ? { passed: true, reason: null } : { passed: false, reason: `Expected "${assertion.path}" to not equal "${expected}".` };
    case "contains":
      return actualStr !== null && actualStr.includes(expected)
        ? { passed: true, reason: null }
        : { passed: false, reason: `Expected "${assertion.path}" to contain "${expected}", got ${actualStr ?? "undefined"}.` };
    case "notContains":
      return actualStr === null || !actualStr.includes(expected)
        ? { passed: true, reason: null }
        : { passed: false, reason: `Expected "${assertion.path}" to not contain "${expected}".` };
    case "greaterThan": {
      const a = Number(actualStr);
      const e = Number(expected);
      return Number.isFinite(a) && Number.isFinite(e) && a > e
        ? { passed: true, reason: null }
        : { passed: false, reason: `Expected "${assertion.path}" (${actualStr ?? "undefined"}) to be greater than ${expected}.` };
    }
    case "lessThan": {
      const a = Number(actualStr);
      const e = Number(expected);
      return Number.isFinite(a) && Number.isFinite(e) && a < e
        ? { passed: true, reason: null }
        : { passed: false, reason: `Expected "${assertion.path}" (${actualStr ?? "undefined"}) to be less than ${expected}.` };
    }
    case "matchesRegex":
      try {
        return actualStr !== null && new RegExp(expected).test(actualStr)
          ? { passed: true, reason: null }
          : { passed: false, reason: `Expected "${assertion.path}" (${actualStr ?? "undefined"}) to match /${expected}/.` };
      } catch {
        return { passed: false, reason: `"${expected}" is not a valid regular expression.` };
      }
  }
}

// Parses the response body as JSON once, then resolves every configured assertion's path
// against it. A body that isn't valid JSON fails every assertion with the same clear reason
// rather than throwing - an assertion-based API monitor pointed at a non-JSON endpoint should
// report "why" it can never pass, not crash the check.
export function evaluateAssertions(bodyText: string, assertions: ApiAssertion[]): ApiAssertionResult[] {
  if (assertions.length === 0) return [];

  let parsed: unknown;
  let parseError: string | null = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parseError = "Response body is not valid JSON.";
  }

  return assertions.map((assertion) => {
    if (parseError) {
      return { ...assertion, actualValue: null, passed: false, reason: parseError };
    }
    const actualValue = resolveJsonPath(parsed, assertion.path);
    const { passed, reason } = evaluateOne(actualValue, assertion);
    return { ...assertion, actualValue: stringifyActual(actualValue), passed, reason };
  });
}
