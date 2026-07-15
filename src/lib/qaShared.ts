import { sql } from "./db";

// Shared row types, validation constants, and the test-case filter builder for the QA
// Testing Management module's API routes. Next.js's App Router enforces at build time
// (checked only by `next build`, not plain `tsc --noEmit`) that a route.ts file may export
// nothing besides its HTTP method handlers and a small allow-list of config values — any
// other named export (a shared type, a constant, a helper function) fails the build. So
// anything route files need to share with each other lives here instead of being exported
// from one route.ts and imported by another.

export interface QaProjectRow {
  Id: number;
  Name: string;
  Description: string | null;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface QaModuleRow {
  Id: number;
  ProjectId: number;
  Name: string;
  Description: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface QaReleaseRow {
  Id: number;
  ProjectId: number;
  Name: string;
  ReleaseDate: string | null;
  Status: string;
  ReleasedByUserId: number | null;
  ReleasedAt: string | null;
  CreatedAt: string;
}

export interface QaTestSuiteRow {
  Id: number;
  ProjectId: number;
  ModuleId: number | null;
  Name: string;
  Description: string | null;
  RequirementRef: string | null;
  Status: string;
  CreatedByUserId: number | null;
  UpdatedByUserId: number | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface QaTestCaseRow {
  Id: number;
  ProjectId: number;
  ModuleId: number | null;
  TestSuiteId: number;
  TestCaseNumber: string;
  Title: string;
  Description: string | null;
  Preconditions: string | null;
  ExpectedResult: string | null;
  Priority: string;
  Severity: string | null;
  TestType: string;
  AutomationStatus: string;
  EstimatedMinutes: number | null;
  Status: string;
  ReviewedByUserId: number | null;
  ReviewedAt: string | null;
  CreatedByUserId: number | null;
  UpdatedByUserId: number | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface QaTestCaseStepRow {
  Id: number;
  StepNumber: number;
  Action: string;
  TestData: string | null;
  ExpectedResult: string | null;
}

export interface QaTestCaseStepInput {
  stepNumber: number;
  action: string;
  testData?: string | null;
  expectedResult?: string | null;
}

export const VALID_PRIORITIES = new Set(["Low", "Medium", "High", "Critical"]);
export const VALID_TEST_TYPES = new Set([
  "Functional", "Regression", "Smoke", "Integration", "API", "UI", "Performance", "Security", "User Acceptance",
]);
export const VALID_TEST_CASE_STATUSES = new Set(["Draft", "Ready", "Approved", "Deprecated", "Archived"]);
export const VALID_AUTOMATION_STATUSES = new Set(["Manual", "Automated", "To Be Automated"]);
export const VALID_TEST_SUITE_STATUSES = new Set(["Active", "Archived"]);
export const VALID_RELEASE_STATUSES = new Set(["Planned", "In Progress", "Released", "Cancelled"]);

export const ALLOWED_TEST_CASE_SORT_COLUMNS = new Set([
  "TestCaseNumber", "Title", "Priority", "Status", "TestType", "CreatedAt", "UpdatedAt",
]);

export interface QaTestRunRow {
  Id: number;
  TestRunNumber: string;
  Name: string;
  Description: string | null;
  ProjectId: number;
  ReleaseId: number | null;
  Environment: string | null;
  Browser: string | null;
  OperatingSystem: string | null;
  Device: string | null;
  StartDate: string | null;
  EndDate: string | null;
  Status: string;
  RunTypeId: number | null;
  RunTypeName?: string | null;
  EnvironmentId: number | null;
  EnvironmentName?: string | null;
  BuildId: number | null;
  BuildNumber?: string | null;
  DeployedBuildVersion: string | null;
  DeployedAt: string | null;
  QaApprovedByUserId: number | null;
  QaApprovedAt: string | null;
  CreatedByUserId: number | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface QaTestRunCaseRow {
  Id: number;
  TestRunId: number;
  TestCaseId: number;
  AssignedUserId: number | null;
  CreatedAt: string;
}

export interface QaTestExecutionRow {
  Id: number;
  TestRunCaseId: number;
  Result: string;
  ActualResult: string | null;
  Notes: string | null;
  DurationMinutes: number | null;
  Browser: string | null;
  Device: string | null;
  OperatingSystem: string | null;
  AppVersion: string | null;
  ExecutedByUserId: number | null;
  ExecutedAt: string;
}

export interface QaBugRow {
  Id: number;
  BugNumber: string;
  Title: string;
  Description: string | null;
  ProjectId: number;
  TestCaseId: number | null;
  TestExecutionId: number | null;
  TestRunId: number | null;
  StepsToReproduce: string | null;
  ExpectedResult: string | null;
  ActualResult: string | null;
  Severity: string;
  Priority: string;
  Status: string;
  AssignedDeveloperUserId: number | null;
  ReporterUserId: number | null;
  Environment: string | null;
  Browser: string | null;
  Device: string | null;
  AppVersion: string | null;
  CreatedAt: string;
  UpdatedAt: string;
  ResolvedAt: string | null;
}

export interface QaAttachmentRow {
  Id: number;
  EntityType: string;
  EntityId: number;
  FilePath: string;
  OriginalFileName: string;
  ContentType: string | null;
  SizeBytes: number;
  UploadedByUserId: number | null;
  UploadedAt: string;
}

export const VALID_TEST_RUN_STATUSES = new Set(["Planned", "In Progress", "Paused", "Completed", "Cancelled"]);

// Run types are a DB-backed lookup (QaTestRunTypes), not a fixed enum — a test case can carry
// any number of them (QaTestCaseRunTypes), and selecting a run type when creating a test run
// pre-filters the test-case picker to just that type's cases. See
// scripts/migrate-qa-test-run-types.ts for the seeded defaults (Smoke/Regression/Release/
// Security/Browser Compatibility/Mobile/Production Verification/Custom).
export interface QaTestRunTypeRow {
  Id: number;
  Name: string;
  Description: string | null;
  IsActive: boolean;
}
export const VALID_EXECUTION_RESULTS = new Set(["Passed", "Failed", "Blocked", "Skipped", "Not Run"]);
export const VALID_BUG_STATUSES = new Set([
  "New", "Open", "In Progress", "Resolved", "Ready for Retest", "Verified", "Closed", "Rejected", "Duplicate", "Reopened",
]);
// Bug Severity/Priority reuse the same Low/Medium/High/Critical scale test cases use — the
// migration's default ('Medium') and column shape (VARCHAR(20)) match VALID_PRIORITIES exactly.
export const VALID_BUG_SEVERITIES = VALID_PRIORITIES;

export const ALLOWED_TEST_RUN_SORT_COLUMNS = new Set(["TestRunNumber", "Name", "Status", "StartDate", "CreatedAt"]);
export const ALLOWED_BUG_SORT_COLUMNS = new Set(["BugNumber", "Title", "Severity", "Priority", "Status", "CreatedAt", "UpdatedAt"]);

// Statuses that mark a bug as no-longer-outstanding — entering one of these auto-stamps
// ResolvedAt; leaving one of these (e.g. Reopened) clears it back to null.
export const BUG_RESOLVED_STATUSES = new Set(["Resolved", "Verified", "Closed"]);

export interface FilterParam {
  name: string;
  type: typeof sql.Int | typeof sql.VarChar | typeof sql.NVarChar;
  value: unknown;
}

export function buildTestCaseFilters(sp: URLSearchParams): { conditions: string[]; params: FilterParam[]; error?: string } {
  const conditions: string[] = [];
  const params: FilterParam[] = [];

  for (const [key, column, type] of [
    ["projectId", "ProjectId", sql.Int],
    ["moduleId", "ModuleId", sql.Int],
    ["testSuiteId", "TestSuiteId", sql.Int],
  ] as const) {
    const raw = sp.get(key);
    if (raw) {
      const value = Number(raw);
      if (!Number.isInteger(value)) return { conditions, params, error: `Invalid ${key}.` };
      params.push({ name: key, type, value });
      conditions.push(`${column} = @${key}`);
    }
  }

  const status = sp.get("status");
  if (status) {
    if (!VALID_TEST_CASE_STATUSES.has(status)) return { conditions, params, error: "Invalid status filter." };
    params.push({ name: "status", type: sql.VarChar, value: status });
    conditions.push("Status = @status");
  }
  const priority = sp.get("priority");
  if (priority) {
    if (!VALID_PRIORITIES.has(priority)) return { conditions, params, error: "Invalid priority filter." };
    params.push({ name: "priority", type: sql.VarChar, value: priority });
    conditions.push("Priority = @priority");
  }
  const testType = sp.get("testType");
  if (testType) {
    if (!VALID_TEST_TYPES.has(testType)) return { conditions, params, error: "Invalid testType filter." };
    params.push({ name: "testType", type: sql.VarChar, value: testType });
    conditions.push("TestType = @testType");
  }
  const search = sp.get("search");
  if (search && search.trim()) {
    params.push({ name: "search", type: sql.NVarChar, value: `%${search.trim().slice(0, 200)}%` });
    conditions.push("(Title LIKE @search OR TestCaseNumber LIKE @search)");
  }
  if (!sp.get("includeArchived")) {
    conditions.push("Status <> 'Archived'");
  }

  // "Auto-Load Test Cases" for a given run type: a test case can carry multiple run types
  // (QaTestCaseRunTypes), so this is an EXISTS check, not a column equality.
  const runTypeIdRaw = sp.get("runTypeId");
  if (runTypeIdRaw) {
    const runTypeId = Number(runTypeIdRaw);
    if (!Number.isInteger(runTypeId)) return { conditions, params, error: "Invalid runTypeId." };
    params.push({ name: "runTypeId", type: sql.Int, value: runTypeId });
    conditions.push("EXISTS (SELECT 1 FROM QaTestCaseRunTypes WHERE TestCaseId = Id AND RunTypeId = @runTypeId)");
  }

  return { conditions, params };
}

export function buildTestRunFilters(sp: URLSearchParams): { conditions: string[]; params: FilterParam[]; error?: string } {
  const conditions: string[] = [];
  const params: FilterParam[] = [];

  for (const [key, column, type] of [
    ["projectId", "ProjectId", sql.Int],
    ["releaseId", "ReleaseId", sql.Int],
  ] as const) {
    const raw = sp.get(key);
    if (raw) {
      const value = Number(raw);
      if (!Number.isInteger(value)) return { conditions, params, error: `Invalid ${key}.` };
      params.push({ name: key, type, value });
      conditions.push(`${column} = @${key}`);
    }
  }

  const status = sp.get("status");
  if (status) {
    if (!VALID_TEST_RUN_STATUSES.has(status)) return { conditions, params, error: "Invalid status filter." };
    params.push({ name: "status", type: sql.VarChar, value: status });
    conditions.push("Status = @status");
  }
  const search = sp.get("search");
  if (search && search.trim()) {
    params.push({ name: "search", type: sql.NVarChar, value: `%${search.trim().slice(0, 200)}%` });
    conditions.push("(Name LIKE @search OR TestRunNumber LIKE @search)");
  }

  return { conditions, params };
}

export function buildBugFilters(sp: URLSearchParams): { conditions: string[]; params: FilterParam[]; error?: string } {
  const conditions: string[] = [];
  const params: FilterParam[] = [];

  for (const [key, column, type] of [
    ["projectId", "ProjectId", sql.Int],
    ["testRunId", "TestRunId", sql.Int],
    ["assignedDeveloperUserId", "AssignedDeveloperUserId", sql.Int],
    ["reporterUserId", "ReporterUserId", sql.Int],
  ] as const) {
    const raw = sp.get(key);
    if (raw) {
      const value = Number(raw);
      if (!Number.isInteger(value)) return { conditions, params, error: `Invalid ${key}.` };
      params.push({ name: key, type, value });
      conditions.push(`${column} = @${key}`);
    }
  }

  const status = sp.get("status");
  if (status) {
    if (!VALID_BUG_STATUSES.has(status)) return { conditions, params, error: "Invalid status filter." };
    params.push({ name: "status", type: sql.VarChar, value: status });
    conditions.push("Status = @status");
  }
  const severity = sp.get("severity");
  if (severity) {
    if (!VALID_BUG_SEVERITIES.has(severity)) return { conditions, params, error: "Invalid severity filter." };
    params.push({ name: "severity", type: sql.VarChar, value: severity });
    conditions.push("Severity = @severity");
  }
  const priority = sp.get("priority");
  if (priority) {
    if (!VALID_PRIORITIES.has(priority)) return { conditions, params, error: "Invalid priority filter." };
    params.push({ name: "priority", type: sql.VarChar, value: priority });
    conditions.push("Priority = @priority");
  }
  const search = sp.get("search");
  if (search && search.trim()) {
    params.push({ name: "search", type: sql.NVarChar, value: `%${search.trim().slice(0, 200)}%` });
    conditions.push("(Title LIKE @search OR BugNumber LIKE @search)");
  }

  return { conditions, params };
}

// --- Structural core: Requirements, Test Plans, Milestones, Environments, Builds ---
// See scripts/migrate-qa-structural-core.ts. All five follow the same no-hard-delete,
// Status-lifecycle convention as every other QA entity.

export interface QaRequirementRow {
  Id: number;
  RequirementNumber: string;
  ProjectId: number;
  Title: string;
  Description: string | null;
  Category: string | null;
  Priority: string;
  Status: string;
  CreatedByUserId: number | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface QaTestPlanRow {
  Id: number;
  TestPlanNumber: string;
  ProjectId: number;
  ReleaseId: number | null;
  Name: string;
  Description: string | null;
  Status: string;
  CreatedByUserId: number | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface QaMilestoneRow {
  Id: number;
  ProjectId: number;
  ReleaseId: number | null;
  Name: string;
  MilestoneType: string;
  DueDate: string | null;
  Status: string;
  Description: string | null;
  CreatedByUserId: number | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface QaEnvironmentRow {
  Id: number;
  ProjectId: number;
  Name: string;
  ApiUrl: string | null;
  DatabaseInfo: string | null;
  BuildVersion: string | null;
  ConfigNotes: string | null;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface QaBuildRow {
  Id: number;
  ProjectId: number;
  ReleaseId: number | null;
  BuildNumber: string;
  GitCommit: string | null;
  Branch: string | null;
  DeploymentDate: string | null;
  EnvironmentId: number | null;
  Status: string;
  CreatedByUserId: number | null;
  CreatedAt: string;
}

export const VALID_REQUIREMENT_STATUSES = new Set(["New", "Approved", "Implemented", "Verified", "Deprecated"]);
export const VALID_MILESTONE_STATUSES = new Set(["Planned", "In Progress", "Completed", "Missed"]);
export const VALID_MILESTONE_TYPES = new Set(["Sprint", "Release Milestone"]);
export const VALID_BUILD_STATUSES = new Set(["Pending", "Deployed", "Failed", "Rolled Back"]);
// Test Plans reuse the exact same lifecycle as Test Runs (Planned/In Progress/Paused/
// Completed/Cancelled) — a plan is "in progress" for as long as any of its linked runs are.

export const ALLOWED_REQUIREMENT_SORT_COLUMNS = new Set(["RequirementNumber", "Title", "Priority", "Status", "CreatedAt"]);
export const ALLOWED_TEST_PLAN_SORT_COLUMNS = new Set(["TestPlanNumber", "Name", "Status", "CreatedAt"]);
export const ALLOWED_MILESTONE_SORT_COLUMNS = new Set(["Name", "MilestoneType", "DueDate", "Status", "CreatedAt"]);

export function buildRequirementFilters(sp: URLSearchParams): { conditions: string[]; params: FilterParam[]; error?: string } {
  const conditions: string[] = [];
  const params: FilterParam[] = [];

  const projectId = sp.get("projectId");
  if (projectId) {
    const value = Number(projectId);
    if (!Number.isInteger(value)) return { conditions, params, error: "Invalid projectId." };
    params.push({ name: "projectId", type: sql.Int, value });
    conditions.push("ProjectId = @projectId");
  }
  const status = sp.get("status");
  if (status) {
    if (!VALID_REQUIREMENT_STATUSES.has(status)) return { conditions, params, error: "Invalid status filter." };
    params.push({ name: "status", type: sql.VarChar, value: status });
    conditions.push("Status = @status");
  }
  const priority = sp.get("priority");
  if (priority) {
    if (!VALID_PRIORITIES.has(priority)) return { conditions, params, error: "Invalid priority filter." };
    params.push({ name: "priority", type: sql.VarChar, value: priority });
    conditions.push("Priority = @priority");
  }
  const search = sp.get("search");
  if (search && search.trim()) {
    params.push({ name: "search", type: sql.NVarChar, value: `%${search.trim().slice(0, 200)}%` });
    conditions.push("(Title LIKE @search OR RequirementNumber LIKE @search)");
  }

  return { conditions, params };
}

export function buildTestPlanFilters(sp: URLSearchParams): { conditions: string[]; params: FilterParam[]; error?: string } {
  const conditions: string[] = [];
  const params: FilterParam[] = [];

  for (const [key, column, type] of [
    ["projectId", "ProjectId", sql.Int],
    ["releaseId", "ReleaseId", sql.Int],
  ] as const) {
    const raw = sp.get(key);
    if (raw) {
      const value = Number(raw);
      if (!Number.isInteger(value)) return { conditions, params, error: `Invalid ${key}.` };
      params.push({ name: key, type, value });
      conditions.push(`${column} = @${key}`);
    }
  }
  const status = sp.get("status");
  if (status) {
    if (!VALID_TEST_RUN_STATUSES.has(status)) return { conditions, params, error: "Invalid status filter." };
    params.push({ name: "status", type: sql.VarChar, value: status });
    conditions.push("Status = @status");
  }
  const search = sp.get("search");
  if (search && search.trim()) {
    params.push({ name: "search", type: sql.NVarChar, value: `%${search.trim().slice(0, 200)}%` });
    conditions.push("(Name LIKE @search OR TestPlanNumber LIKE @search)");
  }

  return { conditions, params };
}

export function buildMilestoneFilters(sp: URLSearchParams): { conditions: string[]; params: FilterParam[]; error?: string } {
  const conditions: string[] = [];
  const params: FilterParam[] = [];

  for (const [key, column, type] of [
    ["projectId", "ProjectId", sql.Int],
    ["releaseId", "ReleaseId", sql.Int],
  ] as const) {
    const raw = sp.get(key);
    if (raw) {
      const value = Number(raw);
      if (!Number.isInteger(value)) return { conditions, params, error: `Invalid ${key}.` };
      params.push({ name: key, type, value });
      conditions.push(`${column} = @${key}`);
    }
  }
  const status = sp.get("status");
  if (status) {
    if (!VALID_MILESTONE_STATUSES.has(status)) return { conditions, params, error: "Invalid status filter." };
    params.push({ name: "status", type: sql.VarChar, value: status });
    conditions.push("Status = @status");
  }
  const milestoneType = sp.get("milestoneType");
  if (milestoneType) {
    if (!VALID_MILESTONE_TYPES.has(milestoneType)) return { conditions, params, error: "Invalid milestoneType filter." };
    params.push({ name: "milestoneType", type: sql.VarChar, value: milestoneType });
    conditions.push("MilestoneType = @milestoneType");
  }
  const search = sp.get("search");
  if (search && search.trim()) {
    params.push({ name: "search", type: sql.NVarChar, value: `%${search.trim().slice(0, 200)}%` });
    conditions.push("Name LIKE @search");
  }

  return { conditions, params };
}
