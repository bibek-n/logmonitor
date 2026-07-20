import { describe, it, expect } from "vitest";
import {
  TEST_CASE_STATUS_TONE, TEST_SUITE_STATUS_TONE, TEST_RUN_STATUS_TONE, EXECUTION_RESULT_TONE,
  BUG_STATUS_TONE, PRIORITY_TONE, toneFor,
} from "./qaBadgeTones";
import {
  VALID_TEST_CASE_STATUSES, VALID_TEST_SUITE_STATUSES, VALID_TEST_RUN_STATUSES,
  VALID_EXECUTION_RESULTS, VALID_BUG_STATUSES, VALID_PRIORITIES,
} from "./qaShared";

describe("toneFor", () => {
  it("returns the mapped tone for a known value", () => {
    expect(toneFor(PRIORITY_TONE, "Critical")).toBe("danger");
  });

  it("falls back to neutral for an unmapped value", () => {
    expect(toneFor(PRIORITY_TONE, "Unknown Value")).toBe("neutral");
  });
});

describe("badge tone maps cover every value the DB can actually produce", () => {
  it("covers every VALID_TEST_CASE_STATUSES value", () => {
    for (const s of VALID_TEST_CASE_STATUSES) expect(TEST_CASE_STATUS_TONE[s]).toBeDefined();
  });
  it("covers every VALID_TEST_SUITE_STATUSES value", () => {
    for (const s of VALID_TEST_SUITE_STATUSES) expect(TEST_SUITE_STATUS_TONE[s]).toBeDefined();
  });
  it("covers every VALID_TEST_RUN_STATUSES value", () => {
    for (const s of VALID_TEST_RUN_STATUSES) expect(TEST_RUN_STATUS_TONE[s]).toBeDefined();
  });
  it("covers every VALID_EXECUTION_RESULTS value, plus the synthetic 'Not Run'", () => {
    for (const s of VALID_EXECUTION_RESULTS) expect(EXECUTION_RESULT_TONE[s]).toBeDefined();
    expect(EXECUTION_RESULT_TONE["Not Run"]).toBeDefined();
  });
  it("covers every VALID_BUG_STATUSES value", () => {
    for (const s of VALID_BUG_STATUSES) expect(BUG_STATUS_TONE[s]).toBeDefined();
  });
  it("covers every VALID_PRIORITIES value (shared by Priority and Severity badges)", () => {
    for (const s of VALID_PRIORITIES) expect(PRIORITY_TONE[s]).toBeDefined();
  });
});
