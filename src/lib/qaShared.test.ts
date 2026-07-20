import { describe, it, expect } from "vitest";
import {
  buildTestCaseFilters, buildTestRunFilters, buildBugFilters,
  VALID_PRIORITIES, VALID_TEST_TYPES, VALID_TEST_CASE_STATUSES, VALID_AUTOMATION_STATUSES,
  VALID_TEST_SUITE_STATUSES, VALID_RELEASE_STATUSES, VALID_TEST_RUN_STATUSES, VALID_EXECUTION_RESULTS,
  VALID_BUG_STATUSES, VALID_BUG_SEVERITIES, BUG_RESOLVED_STATUSES,
  ALLOWED_TEST_CASE_SORT_COLUMNS, ALLOWED_TEST_RUN_SORT_COLUMNS, ALLOWED_BUG_SORT_COLUMNS,
} from "./qaShared";

function sp(params: Record<string, string>): URLSearchParams {
  return new URLSearchParams(params);
}

describe("buildTestCaseFilters", () => {
  it("returns no conditions for an empty query", () => {
    const { conditions, error } = buildTestCaseFilters(sp({}));
    expect(error).toBeUndefined();
    // Status <> 'Archived' is always appended unless includeArchived is set.
    expect(conditions).toEqual(["Status <> 'Archived'"]);
  });

  it("builds an equality condition for projectId/moduleId/testSuiteId", () => {
    const { conditions, params } = buildTestCaseFilters(sp({ projectId: "3", moduleId: "5", testSuiteId: "7" }));
    expect(conditions).toEqual(
      expect.arrayContaining(["ProjectId = @projectId", "ModuleId = @moduleId", "TestSuiteId = @testSuiteId"])
    );
    expect(params.map((p) => p.name)).toEqual(expect.arrayContaining(["projectId", "moduleId", "testSuiteId"]));
  });

  it("rejects a non-integer projectId", () => {
    const { error } = buildTestCaseFilters(sp({ projectId: "abc" }));
    expect(error).toBe("Invalid projectId.");
  });

  it("rejects an unrecognized status value", () => {
    const { error } = buildTestCaseFilters(sp({ status: "Bogus" }));
    expect(error).toBe("Invalid status filter.");
  });

  it("accepts every value in VALID_TEST_CASE_STATUSES", () => {
    for (const status of VALID_TEST_CASE_STATUSES) {
      const { error } = buildTestCaseFilters(sp({ status }));
      expect(error).toBeUndefined();
    }
  });

  it("rejects an unrecognized priority value", () => {
    const { error } = buildTestCaseFilters(sp({ priority: "Urgent" }));
    expect(error).toBe("Invalid priority filter.");
  });

  it("rejects an unrecognized testType value", () => {
    const { error } = buildTestCaseFilters(sp({ testType: "Bogus" }));
    expect(error).toBe("Invalid testType filter.");
  });

  it("builds a LIKE condition for search, capped at 200 chars and wrapped in %", () => {
    const longSearch = "x".repeat(300);
    const { conditions, params } = buildTestCaseFilters(sp({ search: longSearch }));
    expect(conditions).toContain("(Title LIKE @search OR TestCaseNumber LIKE @search)");
    const searchParam = params.find((p) => p.name === "search");
    expect(searchParam?.value).toBe(`%${"x".repeat(200)}%`);
  });

  it("omits the archived-exclusion clause when includeArchived is set", () => {
    const { conditions } = buildTestCaseFilters(sp({ includeArchived: "true" }));
    expect(conditions).not.toContain("Status <> 'Archived'");
  });
});

describe("buildTestRunFilters", () => {
  it("rejects a non-integer releaseId", () => {
    const { error } = buildTestRunFilters(sp({ releaseId: "nope" }));
    expect(error).toBe("Invalid releaseId.");
  });

  it("rejects an unrecognized status", () => {
    const { error } = buildTestRunFilters(sp({ status: "Bogus" }));
    expect(error).toBe("Invalid status filter.");
  });

  it("accepts every value in VALID_TEST_RUN_STATUSES", () => {
    for (const status of VALID_TEST_RUN_STATUSES) {
      expect(buildTestRunFilters(sp({ status })).error).toBeUndefined();
    }
  });

  it("searches by Name or TestRunNumber", () => {
    const { conditions } = buildTestRunFilters(sp({ search: "TR-000" }));
    expect(conditions).toContain("(Name LIKE @search OR TestRunNumber LIKE @search)");
  });
});

describe("buildBugFilters", () => {
  it("rejects a non-integer assignedDeveloperUserId", () => {
    const { error } = buildBugFilters(sp({ assignedDeveloperUserId: "x" }));
    expect(error).toBe("Invalid assignedDeveloperUserId.");
  });

  it("rejects an unrecognized bug status", () => {
    const { error } = buildBugFilters(sp({ status: "Bogus" }));
    expect(error).toBe("Invalid status filter.");
  });

  it("accepts every value in VALID_BUG_STATUSES", () => {
    for (const status of VALID_BUG_STATUSES) {
      expect(buildBugFilters(sp({ status })).error).toBeUndefined();
    }
  });

  it("rejects an unrecognized severity", () => {
    const { error } = buildBugFilters(sp({ severity: "Extreme" }));
    expect(error).toBe("Invalid severity filter.");
  });

  it("rejects an unrecognized priority", () => {
    const { error } = buildBugFilters(sp({ priority: "Extreme" }));
    expect(error).toBe("Invalid priority filter.");
  });

  it("searches by Title or BugNumber", () => {
    const { conditions } = buildBugFilters(sp({ search: "BUG-000" }));
    expect(conditions).toContain("(Title LIKE @search OR BugNumber LIKE @search)");
  });
});

describe("validation constants", () => {
  it("VALID_BUG_SEVERITIES is the same object as VALID_PRIORITIES (bugs reuse the priority scale)", () => {
    expect(VALID_BUG_SEVERITIES).toBe(VALID_PRIORITIES);
  });

  it("BUG_RESOLVED_STATUSES only contains statuses that also exist in VALID_BUG_STATUSES", () => {
    for (const status of BUG_RESOLVED_STATUSES) {
      expect(VALID_BUG_STATUSES.has(status)).toBe(true);
    }
  });

  it("sort-column allow-lists never include a column not implied by the row shape (spot checks)", () => {
    expect(ALLOWED_TEST_CASE_SORT_COLUMNS.has("TestCaseNumber")).toBe(true);
    expect(ALLOWED_TEST_CASE_SORT_COLUMNS.has("DROP TABLE Users")).toBe(false);
    expect(ALLOWED_TEST_RUN_SORT_COLUMNS.has("TestRunNumber")).toBe(true);
    expect(ALLOWED_BUG_SORT_COLUMNS.has("BugNumber")).toBe(true);
  });

  it("every priority/type/status set is non-empty", () => {
    for (const set of [
      VALID_PRIORITIES, VALID_TEST_TYPES, VALID_TEST_CASE_STATUSES, VALID_AUTOMATION_STATUSES,
      VALID_TEST_SUITE_STATUSES, VALID_RELEASE_STATUSES, VALID_TEST_RUN_STATUSES, VALID_EXECUTION_RESULTS,
      VALID_BUG_STATUSES,
    ]) {
      expect(set.size).toBeGreaterThan(0);
    }
  });
});
