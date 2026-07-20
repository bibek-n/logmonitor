import { test, expect } from "@playwright/test";

// End-to-end coverage of the spec's explicit critical workflow: create suite -> create case
// with steps -> create run -> assign tester -> execute -> mark failed -> create bug from
// failure -> resolve/retest bug -> complete run -> view dashboard.
//
// Auth: QA_E2E_SESSION_TOKEN (an env var, not a secret checked into this file) must hold a
// NextAuth session JWT minted for the seeded qa-e2e-test-bot account (see
// scripts/migrate-qa-e2e-test-user.ts + scripts/_mint-e2e-jwt.ts). Real OTP login can't be
// automated headlessly, so this injects the session cookie directly instead.
//
// Every name/title this spec creates is prefixed with MARKER so a follow-up DB sweep
// (same pattern as scripts/test-qa-integration.ts's teardown) can find and remove it —
// the UI has no hard-delete for Projects, so this spec cannot fully self-clean through the
// UI alone.
const MARKER = "__qa_e2e__";
const PROJECT_NAME = `${MARKER}Project`;
const SUITE_NAME = `${MARKER}Suite`;
const CASE_TITLE = `${MARKER}Login works`;
const RUN_NAME = `${MARKER}Run`;
const BUG_TITLE = `${MARKER}Login button does nothing`;

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ context }) => {
  const token = process.env.QA_E2E_SESSION_TOKEN;
  if (!token) throw new Error("QA_E2E_SESSION_TOKEN is required to run this suite.");
  const url = new URL(process.env.QA_E2E_BASE_URL ?? "http://192.168.1.15");
  await context.addCookies([
    { name: "next-auth.session-token", value: token, domain: url.hostname, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
});

let suiteUrl = "";
let runUrl = "";
let bugUrl = "";

test("QA Dashboard loads for an authenticated session", async ({ page }) => {
  await page.goto("/dashboard/qa");
  await expect(page.getByRole("heading", { name: "QA Dashboard" })).toBeVisible();
});

test("create a project and test suite", async ({ page }) => {
  await page.goto("/dashboard/qa/test-suites");
  await page.getByRole("button", { name: "New Test Suite" }).click();

  await page.getByRole("button", { name: "New" }).click();
  await page.getByLabel("Name").fill(PROJECT_NAME);
  await page.getByRole("button", { name: "Create Project" }).click();
  await expect(page.getByText(`Project "${PROJECT_NAME}" created.`)).toBeVisible();

  await page.getByPlaceholder("Select a project").waitFor({ state: "detached" }).catch(() => {});
  const nameInputs = page.locator('input[maxlength="200"]');
  await nameInputs.last().fill(SUITE_NAME);
  await page.getByRole("button", { name: "Create Suite" }).click();
  await expect(page.getByText(`Test suite "${SUITE_NAME}" created.`)).toBeVisible();

  const suiteLink = page.getByRole("link", { name: SUITE_NAME });
  await expect(suiteLink).toBeVisible();
  suiteUrl = await suiteLink.getAttribute("href") ?? "";
  expect(suiteUrl).toContain("/dashboard/qa/test-suites/");
});

test("create a test case with steps under that suite", async ({ page }) => {
  const suiteId = suiteUrl.split("/").pop();
  await page.goto(`/dashboard/qa/test-cases/new?testSuiteId=${suiteId}`);

  await page.locator('input[maxlength="300"]').fill(CASE_TITLE);
  await page.getByRole("button", { name: "Add Step" }).click();
  await page.locator("textarea").first().fill("Open the login page");
  await page.getByRole("button", { name: "Create Test Case" }).click();

  await page.waitForURL(/\/dashboard\/qa\/test-cases\/\d+$/);
  await expect(page.getByText(CASE_TITLE)).toBeVisible();
});

test("create a test run, add the case, and assign the E2E user as tester", async ({ page }) => {
  await page.goto("/dashboard/qa/test-runs");
  await page.getByRole("button", { name: "New Test Run" }).click();

  const projectSelect = page.locator("select").first();
  await projectSelect.selectOption({ label: PROJECT_NAME });
  await page.locator('input[maxlength="200"]').fill(RUN_NAME);
  await page.getByRole("button", { name: "Create Test Run" }).click();
  await expect(page.getByText(`Test run`).and(page.getByText("created."))).toBeVisible();

  const runLink = page.getByRole("link", { name: /^TR-\d{5}$/ }).first();
  runUrl = await runLink.getAttribute("href") ?? "";
  await page.goto(runUrl);

  await page.getByRole("button", { name: "Add Test Cases" }).click();
  await page.getByText(CASE_TITLE).click();
  await page.getByRole("button", { name: /^Add/ }).click();

  const assignSelect = page.locator("table select").first();
  await assignSelect.selectOption({ label: "qa-e2e-test-bot" });
});

test("execute the assigned case and mark it Failed", async ({ page }) => {
  await page.goto("/dashboard/qa/execute");
  await page.getByText(CASE_TITLE).click();

  await page.waitForURL(/\/dashboard\/qa\/execute\/\d+$/);
  await page.getByRole("button", { name: "Failed", exact: true }).click();
  await page.getByRole("button", { name: "Submit Result" }).click();
  await expect(page.getByText("Result recorded: Failed.")).toBeVisible();
});

test("file a bug from the failure, then resolve and reopen it", async ({ page }) => {
  await page.getByRole("link", { name: "File Bug from this Failure" }).click();
  await page.waitForURL(/\/dashboard\/qa\/bugs\?/);

  await page.locator('input[maxlength="300"]').fill(BUG_TITLE);
  await page.getByRole("button", { name: "File Bug" }).click();
  await expect(page.getByText(/Bug BUG-\d{5} filed\./)).toBeVisible();

  const bugLink = page.getByRole("link", { name: /^BUG-\d{5}$/ }).first();
  bugUrl = await bugLink.getAttribute("href") ?? "";
  await page.goto(bugUrl);
  await expect(page.getByText(BUG_TITLE)).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.locator("select").nth(2).selectOption("Resolved");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Bug updated.")).toBeVisible();

  // Retest fails again -> reopen.
  await page.getByRole("button", { name: "Edit" }).click();
  await page.locator("select").nth(2).selectOption("Reopened");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Bug updated.")).toBeVisible();
});

test("complete the test run and confirm the dashboard reflects the new bug", async ({ page }) => {
  await page.goto(runUrl);
  await page.getByRole("button", { name: "Completed" }).click();
  await expect(page.getByText("Run status set to Completed.")).toBeVisible();

  await page.goto("/dashboard/qa");
  await expect(page.getByRole("heading", { name: "QA Dashboard" })).toBeVisible();
  await expect(page.getByText("Recent Open Bugs")).toBeVisible();
  await expect(page.getByText(BUG_TITLE)).toBeVisible();
});
