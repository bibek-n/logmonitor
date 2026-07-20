import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import { withReferenceNumber } from "../src/lib/qaReferenceNumbers";

// One-time content seed: real QA Testing Management data for the Build Up Nepal project
// (github.com/BjornWebsearch/buildupnepal, a Vite/React/Supabase internal PM+CRM system),
// so it's visible in the QA dashboard going forward. Not throwaway/self-cleaning like the
// Phase 5 test scripts — this is meant to persist. Test suites/cases are grounded in the
// app's real page/module structure (explored directly from the cloned repo), not fabricated.
// Automated-suite results are real (from actually running `npx vitest run` against the repo,
// before and after fixing a genuine regression found in ProtectedRoute.test.tsx). The manual
// functional test cases are left Status='Ready' / never executed — I did not click through
// the live app against its real Supabase backend, so recording fabricated Pass results for
// them would be dishonest QA data.

interface StepInput { action: string; testData?: string; expectedResult?: string }

async function main() {
  const db = await getDb();

  const adminRow = await db.query<{ Id: number }>`SELECT TOP 1 Id FROM Users WHERE Role = 'Admin' ORDER BY Id ASC`;
  const adminId = adminRow.recordset[0]?.Id;
  if (!adminId) throw new Error("No Admin user found to attribute this seed to.");

  // --- Project ---
  const projectResult = await db
    .request()
    .input("name", sql.NVarChar, "Build Up Nepal")
    .input("description", sql.NVarChar, "Internal project management & CRM system for Build Up Nepal (github.com/BjornWebsearch/buildupnepal) — Enterprises, Activities, Projects, Planning, Fundraising, Sales, Machine Stock, and a phone-authenticated field staff app. React/Vite/TypeScript frontend, Supabase (Lovable Cloud) backend.")
    .input("createdByUserId", sql.Int, adminId)
    .query<{ Id: number }>(
      "INSERT INTO QaProjects (Name, Description, CreatedByUserId) OUTPUT INSERTED.Id VALUES (@name, @description, @createdByUserId)"
    );
  const projectId = projectResult.recordset[0].Id;
  console.log(`Project: Build Up Nepal (Id ${projectId})`);

  async function createModule(name: string, description: string): Promise<number> {
    const r = await db
      .request()
      .input("projectId", sql.Int, projectId)
      .input("name", sql.NVarChar, name)
      .input("description", sql.NVarChar, description)
      .input("createdByUserId", sql.Int, adminId)
      .query<{ Id: number }>(
        "INSERT INTO QaModules (ProjectId, Name, Description, CreatedByUserId) OUTPUT INSERTED.Id VALUES (@projectId, @name, @description, @createdByUserId)"
      );
    return r.recordset[0].Id;
  }

  async function createSuite(moduleId: number, name: string, description: string): Promise<number> {
    const r = await db
      .request()
      .input("projectId", sql.Int, projectId)
      .input("moduleId", sql.Int, moduleId)
      .input("name", sql.NVarChar, name)
      .input("description", sql.NVarChar, description)
      .input("createdByUserId", sql.Int, adminId)
      .query<{ Id: number }>(
        "INSERT INTO QaTestSuites (ProjectId, ModuleId, Name, Description, CreatedByUserId, UpdatedByUserId) OUTPUT INSERTED.Id VALUES (@projectId, @moduleId, @name, @description, @createdByUserId, @createdByUserId)"
      );
    return r.recordset[0].Id;
  }

  async function createCase(opts: {
    testSuiteId: number;
    title: string;
    description?: string;
    preconditions?: string;
    expectedResult?: string;
    priority?: string;
    testType?: string;
    automationStatus?: string;
    status?: string;
    steps?: StepInput[];
  }): Promise<number> {
    const testCase = await withReferenceNumber("QaTestCases", "TestCaseNumber", "TC", async (transaction, testCaseNumber) => {
      const insertRequest = new sql.Request(transaction);
      const insertResult = await insertRequest
        .input("projectId", sql.Int, projectId)
        .input("testSuiteId", sql.Int, opts.testSuiteId)
        .input("testCaseNumber", sql.VarChar, testCaseNumber)
        .input("title", sql.NVarChar, opts.title)
        .input("description", sql.NVarChar, opts.description ?? null)
        .input("preconditions", sql.NVarChar, opts.preconditions ?? null)
        .input("expectedResult", sql.NVarChar, opts.expectedResult ?? null)
        .input("priority", sql.VarChar, opts.priority ?? "Medium")
        .input("testType", sql.VarChar, opts.testType ?? "Functional")
        .input("automationStatus", sql.VarChar, opts.automationStatus ?? "Manual")
        .input("status", sql.VarChar, opts.status ?? "Ready")
        .input("createdByUserId", sql.Int, adminId)
        .query<{ Id: number }>(`
          INSERT INTO QaTestCases (
            ProjectId, TestSuiteId, TestCaseNumber, Title, Description, Preconditions,
            ExpectedResult, Priority, TestType, AutomationStatus, Status, CreatedByUserId, UpdatedByUserId
          )
          OUTPUT INSERTED.Id
          VALUES (
            @projectId, @testSuiteId, @testCaseNumber, @title, @description, @preconditions,
            @expectedResult, @priority, @testType, @automationStatus, @status, @createdByUserId, @createdByUserId
          )
        `);
      return insertResult.recordset[0];
    });

    if (opts.steps?.length) {
      for (let i = 0; i < opts.steps.length; i++) {
        const step = opts.steps[i];
        await db
          .request()
          .input("testCaseId", sql.Int, testCase.Id)
          .input("stepNumber", sql.Int, i + 1)
          .input("action", sql.NVarChar, step.action)
          .input("testData", sql.NVarChar, step.testData ?? null)
          .input("expectedResult", sql.NVarChar, step.expectedResult ?? null)
          .query("INSERT INTO QaTestCaseSteps (TestCaseId, StepNumber, Action, TestData, ExpectedResult) VALUES (@testCaseId, @stepNumber, @action, @testData, @expectedResult)");
      }
    }

    return testCase.Id;
  }

  // ============================================================
  // Authentication & Access Control
  // ============================================================
  const authModule = await createModule("Authentication & Access Control", "Login, session handling, and role/permission-based routing.");
  const authSuite = await createSuite(authModule, "Authentication & Access Control", "src/contexts/AuthContext.tsx, src/components/ProtectedRoute.tsx, src/pages/Auth.tsx, src/pages/PermissionsManagement.tsx");

  await createCase({
    testSuiteId: authSuite, title: "Staff logs in with valid email/password", priority: "Critical",
    preconditions: "A valid staff account exists in Supabase Auth.",
    expectedResult: "User is redirected to the dashboard (or /planning if non-admin) with a valid session.",
    steps: [
      { action: "Navigate to /auth", expectedResult: "Login form is shown" },
      { action: "Enter a valid staff email and password, submit", expectedResult: "Redirected away from /auth" },
      { action: "Reload the page", expectedResult: "Session persists — not redirected back to /auth" },
    ],
  });
  await createCase({
    testSuiteId: authSuite, title: "Login fails with invalid credentials", priority: "High",
    expectedResult: "An error message is shown; user remains on /auth with no session established.",
  });
  await createCase({
    testSuiteId: authSuite, title: "Non-admin is redirected away from admin-only routes", priority: "Critical",
    preconditions: "Logged in as a non-admin staff user.",
    expectedResult: "Navigating to /projects, /fundraising, /settings, or /backup redirects to /planning instead of rendering the page.",
  });
  await createCase({
    testSuiteId: authSuite, title: "Role/permission change in PermissionsManagement takes effect", priority: "High",
    expectedResult: "After an admin changes a staff member's module access, that staff member's next session reflects the new access (sales/planning/activities/enterprises/todo gates).",
  });

  // ============================================================
  // Enterprises
  // ============================================================
  const enterprisesModule = await createModule("Enterprises", "Brick-production entrepreneur records and site visits.");
  const enterprisesSuite = await createSuite(enterprisesModule, "Enterprises", "src/pages/Enterprises.tsx, src/pages/EnterpriseVisits.tsx, src/components/enterprises/");

  await createCase({
    testSuiteId: enterprisesSuite, title: "Create a new enterprise record", priority: "High",
    expectedResult: "The new enterprise appears in the Enterprises list with the entered details.",
    steps: [
      { action: "Open Enterprises and click Add/New", expectedResult: "Create form opens" },
      { action: "Fill required fields (name, category, location, contact) and save", expectedResult: "Record is created" },
      { action: "Find the record in the list", expectedResult: "All entered fields match" },
    ],
  });
  await createCase({
    testSuiteId: enterprisesSuite, title: "Edit an existing enterprise's details", priority: "Medium",
    expectedResult: "Changes are saved and reflected immediately in the list/detail view.",
  });
  await createCase({
    testSuiteId: enterprisesSuite, title: "Search/filter the enterprises list", priority: "Medium",
    expectedResult: "Only enterprises matching the search term/filter are shown; clearing the filter restores the full list.",
  });
  await createCase({
    testSuiteId: enterprisesSuite, title: "Log a field visit against an enterprise", priority: "Medium",
    expectedResult: "The visit appears in that enterprise's visit history with the recorded date/notes.",
  });

  // ============================================================
  // Activities
  // ============================================================
  const activitiesModule = await createModule("Activities", "Training events, workshops, and field activity tracking.");
  const activitiesSuite = await createSuite(activitiesModule, "Activities", "src/pages/Activities.tsx, src/components/activities/, src/hooks/activities/");

  await createCase({
    testSuiteId: activitiesSuite, title: "Create a new training/workshop activity event", priority: "High",
    expectedResult: "The activity appears in the Activities list with correct date, type, and location.",
  });
  await createCase({
    testSuiteId: activitiesSuite, title: "Record attendance/participants for an activity", priority: "Medium",
    expectedResult: "Participant count and details are saved and visible on the activity's detail view.",
  });
  await createCase({
    testSuiteId: activitiesSuite, title: "Filter activities by date range and type", priority: "Low",
    expectedResult: "Only activities within the selected range/type are shown.",
  });

  // ============================================================
  // Projects & Construction
  // ============================================================
  const projectsModule = await createModule("Projects & Construction", "Donor-funded project tracking, milestones/targets, and construction progress.");
  const projectsSuite = await createSuite(projectsModule, "Projects & Construction", "src/pages/Projects.tsx, src/pages/ProjectDetail.tsx, src/pages/Construction.tsx, src/hooks/project-detail/");

  await createCase({
    testSuiteId: projectsSuite, title: "Create a donor-funded project with milestones", priority: "Critical",
    expectedResult: "Project appears in Projects list; ProjectDetail shows the defined milestones/targets.",
  });
  await createCase({
    testSuiteId: projectsSuite, title: "Update a project milestone's progress", priority: "High",
    expectedResult: "Progress percentage/status updates on both ProjectDetail and any project-level summary.",
  });
  await createCase({
    testSuiteId: projectsSuite, title: "Log a construction progress entry", priority: "Medium",
    expectedResult: "Entry appears on the Construction page tied to the correct project.",
  });

  // ============================================================
  // Planning
  // ============================================================
  const planningModule = await createModule("Planning", "Weekly staff timesheet and planning.");
  const planningSuite = await createSuite(planningModule, "Planning", "src/pages/Planning.tsx, src/hooks/planning/");

  await createCase({
    testSuiteId: planningSuite, title: "Staff submits a weekly plan/timesheet", priority: "High",
    expectedResult: "Entry is saved against the correct staff member and week.",
  });
  await createCase({
    testSuiteId: planningSuite, title: "Manager reviews the team's weekly plans", priority: "Medium",
    expectedResult: "All team members' submitted plans for the selected week are visible to the manager.",
  });

  // ============================================================
  // Fundraising & Donor Communications
  // ============================================================
  const fundraisingModule = await createModule("Fundraising & Donor Communications", "CRM for donors/partners/grants, and donor communication history.");
  const fundraisingSuite = await createSuite(fundraisingModule, "Fundraising & Donor Communications", "src/pages/Fundraising.tsx, src/pages/DonorComs.tsx, supabase/functions/notify-payment-request");

  await createCase({
    testSuiteId: fundraisingSuite, title: "Add a new donor/partner lead to the fundraising pipeline", priority: "High",
    expectedResult: "Lead appears in the Fundraising CRM with correct stage/status.",
  });
  await createCase({
    testSuiteId: fundraisingSuite, title: "Log a donor communication", priority: "Medium",
    expectedResult: "The communication (call/email/meeting note) appears in that donor's history.",
  });
  await createCase({
    testSuiteId: fundraisingSuite, title: "Payment-request notification fires on a funding milestone", priority: "High",
    description: "Covers the notify-payment-request edge function.",
    expectedResult: "The configured recipient receives a notification when a payment milestone is reached.",
  });

  // ============================================================
  // Sales
  // ============================================================
  const salesModule = await createModule("Sales", "Sales lead management and machine sales.");
  const salesSuite = await createSuite(salesModule, "Sales", "src/pages/Sales.tsx, src/components/sales/");

  await createCase({
    testSuiteId: salesSuite, title: "Create a new sales lead", priority: "High",
    expectedResult: "Lead appears in the Sales pipeline with correct stage.",
  });
  await createCase({
    testSuiteId: salesSuite, title: "Closing a sale decrements linked machine stock", priority: "High",
    expectedResult: "The Machine Stock quantity for the sold equipment type decreases by the sold amount.",
  });

  // ============================================================
  // Machine Stock
  // ============================================================
  const stockModule = await createModule("Machine Stock", "Equipment inventory across field offices.");
  const stockSuite = await createSuite(stockModule, "Machine Stock", "src/pages/MachineStock.tsx");

  await createCase({
    testSuiteId: stockSuite, title: "Add new equipment to inventory", priority: "Medium",
    expectedResult: "Equipment is listed under the correct field office with the entered quantity.",
  });
  await createCase({
    testSuiteId: stockSuite, title: "Transfer equipment between field offices", priority: "Medium",
    expectedResult: "Stock quantity moves from the source office to the destination office; totals stay consistent.",
  });

  // ============================================================
  // Field Staff App
  // ============================================================
  const fieldModule = await createModule("Field Staff App", "Phone-authenticated mobile experience for field staff.");
  const fieldSuite = await createSuite(fieldModule, "Field Staff App", "src/pages/Field.tsx, src/pages/FieldAuth.tsx, supabase/functions/field-auth, supabase/functions/field-api");

  await createCase({
    testSuiteId: fieldSuite, title: "Field staff logs in via phone-based auth", priority: "Critical",
    description: "Covers the field-auth edge function.",
    expectedResult: "A valid phone number + code grants a session scoped to the field API.",
  });
  await createCase({
    testSuiteId: fieldSuite, title: "Field staff submits an activity event from the mobile app", priority: "High",
    description: "Covers the field-api edge function.",
    expectedResult: "The activity event syncs into the main Activities module and is visible to office staff.",
  });
  await createCase({
    testSuiteId: fieldSuite, title: "Field staff submits a sales lead from the mobile app", priority: "Medium",
    expectedResult: "The lead appears in the Sales CRM, attributed to the submitting field staff member.",
  });

  // ============================================================
  // Settings & Backup
  // ============================================================
  const settingsModule = await createModule("Settings & Backup", "System settings and backup/restore.");
  const settingsSuite = await createSuite(settingsModule, "Settings & Backup", "src/pages/Settings.tsx, src/pages/Backup.tsx, supabase/functions/system-backup");

  await createCase({
    testSuiteId: settingsSuite, title: "Admin updates system settings", priority: "Medium",
    expectedResult: "Changed settings are applied and persisted across sessions.",
  });
  await createCase({
    testSuiteId: settingsSuite, title: "Trigger a manual system backup", priority: "High",
    description: "Covers the system-backup edge function.",
    expectedResult: "A backup snapshot is created and listed on the Backup page.",
  });

  // ============================================================
  // Automated Unit Tests (Vitest) — real results from actually running the suite.
  // ============================================================
  const automationModule = await createModule("Automation", "The project's own Vitest unit/component test suite (npx vitest run).");
  const automationSuite = await createSuite(automationModule, "Automated Unit Tests (Vitest)", "20 test files under src/**/__tests__/, run via `npm test`. Executed directly against a clone of the repo.");

  const passingAutomatedCases = [
    ["FilterBar renders and behaves correctly", "src/components/__tests__/FilterBar.test.tsx"],
    ["PriorityBadge renders correct tone per priority", "src/components/__tests__/PriorityBadge.test.tsx"],
    ["StatusBadge renders correct tone per status", "src/components/__tests__/StatusBadge.test.tsx"],
    ["TagBadge renders correctly", "src/components/__tests__/TagBadge.test.tsx"],
    ["AuthContext provides session state correctly", "src/contexts/__tests__/AuthContext.test.tsx"],
    ["useFilterState manages filter state correctly", "src/hooks/__tests__/useFilterState.test.ts"],
    ["useOnlineStatus reports connectivity correctly", "src/hooks/__tests__/useOnlineStatus.test.ts"],
    ["crypto-utils functions behave correctly", "src/lib/__tests__/crypto-utils.test.ts"],
    ["date-utils functions behave correctly", "src/lib/__tests__/date-utils.test.ts"],
    ["environment detection behaves correctly", "src/lib/__tests__/environment.test.ts"],
    ["error-utils functions behave correctly", "src/lib/__tests__/error-utils.test.ts"],
    ["excel-import parses/maps columns correctly", "src/lib/__tests__/excel-import.test.ts"],
    ["logger behaves correctly", "src/lib/__tests__/logger.test.ts"],
    ["mutation-utils functions behave correctly", "src/lib/__tests__/mutation-utils.test.ts"],
    ["row-highlight logic behaves correctly", "src/lib/__tests__/row-highlight.test.ts"],
    ["sort-utils functions behave correctly", "src/lib/__tests__/sort-utils.test.ts"],
    ["storage-utils functions behave correctly", "src/lib/__tests__/storage-utils.test.ts"],
    ["validation-schemas validate correctly", "src/lib/__tests__/validation-schemas.test.ts"],
    ["example smoke test", "src/test/example.test.ts"],
  ];

  for (const [title, path] of passingAutomatedCases) {
    await createCase({
      testSuiteId: automationSuite, title, description: `Vitest file: ${path}`,
      priority: "Medium", testType: "Regression", automationStatus: "Automated", status: "Approved",
    });
  }

  const protectedRouteCaseId = await createCase({
    testSuiteId: automationSuite, title: "ProtectedRoute gates rendering on auth/permissions state",
    description: "Vitest file: src/components/__tests__/ProtectedRoute.test.tsx",
    expectedResult: "Shows a loading spinner while auth/permissions are resolving; redirects unauthenticated users to /auth; renders children (including multiple children) once authenticated.",
    priority: "Critical", testType: "Regression", automationStatus: "Automated", status: "Approved",
  });

  // --- a Test Run for this pass, with the ProtectedRoute case's REAL execution history ---
  const run = await withReferenceNumber("QaTestRuns", "TestRunNumber", "TR", async (transaction, testRunNumber) => {
    const r = await new sql.Request(transaction)
      .input("testRunNumber", sql.VarChar, testRunNumber)
      .input("name", sql.NVarChar, "Automated suite — initial pass")
      .input("description", sql.NVarChar, "`npx vitest run` against a fresh clone of BjornWebsearch/buildupnepal.")
      .input("projectId", sql.Int, projectId)
      .input("environment", sql.NVarChar, "Local (jsdom)")
      .input("createdByUserId", sql.Int, adminId)
      .query<{ Id: number; TestRunNumber: string }>(
        "INSERT INTO QaTestRuns (TestRunNumber, Name, Description, ProjectId, Environment, Status, CreatedByUserId) OUTPUT INSERTED.Id, INSERTED.TestRunNumber VALUES (@testRunNumber, @name, @description, @projectId, @environment, 'Completed', @createdByUserId)"
      );
    return r.recordset[0];
  });

  async function addRunCase(testCaseId: number): Promise<number> {
    const r = await db
      .request()
      .input("runId", sql.Int, run.Id)
      .input("caseId", sql.Int, testCaseId)
      .input("assignedUserId", sql.Int, adminId)
      .query<{ Id: number }>(
        "INSERT INTO QaTestRunCases (TestRunId, TestCaseId, AssignedUserId) OUTPUT INSERTED.Id VALUES (@runId, @caseId, @assignedUserId)"
      );
    return r.recordset[0].Id;
  }

  async function recordExecution(runCaseId: number, result: string, notes: string, secondsAgo: number) {
    await db
      .request()
      .input("rcId", sql.Int, runCaseId)
      .input("result", sql.VarChar, result)
      .input("notes", sql.NVarChar, notes)
      .input("executedByUserId", sql.Int, adminId)
      .input("secondsAgo", sql.Int, secondsAgo)
      .query(
        "INSERT INTO QaTestExecutions (TestRunCaseId, Result, Notes, ExecutedByUserId, ExecutedAt) VALUES (@rcId, @result, @notes, @executedByUserId, DATEADD(SECOND, -@secondsAgo, SYSUTCDATETIME()))"
      );
  }

  // 19 already-passing automated cases, in this run.
  const allCases = await db.request().input("suiteId", sql.Int, automationSuite).query<{ Id: number; Title: string }>(
    "SELECT Id, Title FROM QaTestCases WHERE TestSuiteId = @suiteId ORDER BY Id ASC"
  );
  for (const c of allCases.recordset) {
    if (c.Id === protectedRouteCaseId) continue;
    const rcId = await addRunCase(c.Id);
    await recordExecution(rcId, "Passed", "npx vitest run — passed.", 300);
  }

  // ProtectedRoute: real history — first Failed (stale mock), then Passed after the fix.
  const prcRunCaseId = await addRunCase(protectedRouteCaseId);
  await recordExecution(prcRunCaseId, "Failed", "3/3 'Authenticated State' + redirect assertions failed: TestingLibraryElementError, element not found (data-testid protected-content/auth-page/header). Root cause: mockUseAuth() only returns { user, loading } — ProtectedRoute.tsx now gates on authReady (added for an RLS-race fix), which the mock never sets, so the component is stuck in its loading branch for every test regardless of the scenario being tested.", 600);
  await recordExecution(prcRunCaseId, "Passed", "Fixed: added authReady to every mockUseAuth() return value in ProtectedRoute.test.tsx, matching AuthContextType's real shape. Re-ran npx vitest run — 20/20 files, 211/211 tests passing.", 60);

  // --- the bug this run found, now resolved ---
  const bug = await withReferenceNumber("QaBugs", "BugNumber", "BUG", async (transaction, bugNumber) => {
    const r = await new sql.Request(transaction)
      .input("bugNumber", sql.VarChar, bugNumber)
      .input("title", sql.NVarChar, "ProtectedRoute.test.tsx mocks are stale — 3 tests can't detect real auth bugs")
      .input("description", sql.NVarChar, "AuthContext.tsx exposes both `loading` and `authReady` (authReady added later to fix a Supabase RLS race on uncached loads — see the doc comment in AuthContext.tsx). ProtectedRoute.tsx was updated to gate its loading state on `authReady`, but ProtectedRoute.test.tsx's mockUseAuth() was never updated to return it. Since authReady was always `undefined` (falsy) in every test, ProtectedRoute stayed permanently in its loading branch — meaning these 3 tests were passing/failing based on a broken harness, not the component's real behavior. Found while running the full suite as part of onboarding this project into QA Testing Management.")
      .input("stepsToReproduce", sql.NVarChar, "1. Clone the repo. 2. Run `npx vitest run`. 3. Observe 3 failures in ProtectedRoute.test.tsx, all `Unable to find an element by [data-testid=...]` with the DOM snapshot showing only the loading spinner.")
      .input("expectedResult", sql.NVarChar, "Each test's mocked user/loading state should be reflected in the rendered output (auth page, protected content, or spinner) matching that scenario.")
      .input("actualResult", sql.NVarChar, "Every 'auth resolved' scenario (unauthenticated redirect, authenticated render, multiple children) still rendered the loading spinner, because authReady was always undefined.")
      .input("projectId", sql.Int, projectId)
      .input("testCaseId", sql.Int, protectedRouteCaseId)
      .input("severity", sql.VarChar, "Medium")
      .input("priority", sql.VarChar, "High")
      .input("reporterUserId", sql.Int, adminId)
      .input("assignedDeveloperUserId", sql.Int, adminId)
      .query<{ Id: number; BugNumber: string }>(`
        INSERT INTO QaBugs (
          BugNumber, Title, Description, StepsToReproduce, ExpectedResult, ActualResult,
          ProjectId, TestCaseId, Severity, Priority, ReporterUserId, AssignedDeveloperUserId, Status, ResolvedAt
        )
        OUTPUT INSERTED.Id, INSERTED.BugNumber
        VALUES (
          @bugNumber, @title, @description, @stepsToReproduce, @expectedResult, @actualResult,
          @projectId, @testCaseId, @severity, @priority, @reporterUserId, @assignedDeveloperUserId, 'Resolved', SYSUTCDATETIME()
        )
      `);
    return r.recordset[0];
  });

  console.log(`Bug filed and resolved: ${bug.BugNumber}`);
  console.log(`Test Run: ${run.TestRunNumber}`);
  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
