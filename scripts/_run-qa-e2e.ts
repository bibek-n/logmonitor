import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { chromium, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { getDb, sql } from "../src/lib/db";

// Runs the full QA E2E workflow end-to-end, entirely within this one server-side process:
// seeds a QA-Manager-scoped throwaway user, mints its session JWT, drives a real headless
// browser against the live app, then deletes everything (the bot user AND every DB row the
// run created) before exiting. The session token never leaves this process — never written
// to a file, never printed, never passed to another process via an env var or argument. Only
// PASS/FAIL lines (and, on failure, a screenshot path) are ever logged.

const BASE_URL = process.env.QA_E2E_BASE_URL ?? "http://192.168.1.15";
const BOT_USERNAME = "qa-e2e-test-bot-inline";
const BOT_ROLE = "QA Manager";
const MARKER = "__qa_e2e__";
const PROJECT_NAME = `${MARKER}Project`;
const SUITE_NAME = `${MARKER}Suite`;
const CASE_TITLE = `${MARKER}Login works`;
const RUN_NAME = `${MARKER}Run`;
const BUG_TITLE = `${MARKER}Login button does nothing`;

let failures = 0;
let botUserId: number | null = null;

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err instanceof Error ? err.message : err}`);
  }
}

async function sweepData() {
  const db = await getDb();
  const like = `${MARKER}%`;

  const bugs = await db.request().input("m", sql.NVarChar, like).query<{ Id: number }>("SELECT Id FROM QaBugs WHERE Title LIKE @m");
  for (const b of bugs.recordset) await db.request().input("id", sql.Int, b.Id).query("DELETE FROM QaBugs WHERE Id = @id");

  const runs = await db.request().input("m", sql.NVarChar, like).query<{ Id: number }>("SELECT Id FROM QaTestRuns WHERE Name LIKE @m");
  for (const r of runs.recordset) {
    const rcs = await db.request().input("runId", sql.Int, r.Id).query<{ Id: number }>("SELECT Id FROM QaTestRunCases WHERE TestRunId = @runId");
    for (const rc of rcs.recordset) await db.request().input("id", sql.Int, rc.Id).query("DELETE FROM QaTestExecutions WHERE TestRunCaseId = @id");
    await db.request().input("runId", sql.Int, r.Id).query("DELETE FROM QaTestRunCases WHERE TestRunId = @runId");
    await db.request().input("id", sql.Int, r.Id).query("DELETE FROM QaTestRuns WHERE Id = @id");
  }

  const cases = await db.request().input("m", sql.NVarChar, like).query<{ Id: number }>("SELECT Id FROM QaTestCases WHERE Title LIKE @m");
  for (const c of cases.recordset) {
    await db.request().input("id", sql.Int, c.Id).query("DELETE FROM QaTestCaseSteps WHERE TestCaseId = @id");
    await db.request().input("id", sql.Int, c.Id).query("DELETE FROM QaTestCaseTags WHERE TestCaseId = @id");
    await db.request().input("id", sql.Int, c.Id).query("DELETE FROM QaTestCases WHERE Id = @id");
  }

  const suites = await db.request().input("m", sql.NVarChar, like).query<{ Id: number }>("SELECT Id FROM QaTestSuites WHERE Name LIKE @m");
  for (const s of suites.recordset) await db.request().input("id", sql.Int, s.Id).query("DELETE FROM QaTestSuites WHERE Id = @id");

  const projects = await db.request().input("m", sql.NVarChar, like).query<{ Id: number }>("SELECT Id FROM QaProjects WHERE Name LIKE @m");
  for (const p of projects.recordset) await db.request().input("id", sql.Int, p.Id).query("DELETE FROM QaProjects WHERE Id = @id");

  return { bugs: bugs.recordset.length, runs: runs.recordset.length, cases: cases.recordset.length, suites: suites.recordset.length, projects: projects.recordset.length };
}

async function main() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set.");

  const db = await getDb();

  // --- seed the scoped-down bot user (QA Manager role, random unusable password) ---
  const randomPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
  const existing = await db.request().input("u", sql.NVarChar, BOT_USERNAME).query<{ Id: number }>("SELECT Id FROM Users WHERE Username = @u");
  if (existing.recordset[0]) {
    botUserId = existing.recordset[0].Id;
  } else {
    const inserted = await db
      .request()
      .input("u", sql.NVarChar, BOT_USERNAME)
      .input("p", sql.NVarChar, randomPasswordHash)
      .input("r", sql.NVarChar, BOT_ROLE)
      .query<{ Id: number }>("INSERT INTO Users (Username, PasswordHash, Role) OUTPUT INSERTED.Id VALUES (@u, @p, @r)");
    botUserId = inserted.recordset[0].Id;
  }
  console.log(`Seeded bot user id=${botUserId}, role=${BOT_ROLE}.`);

  // --- mint the session JWT — kept in this local variable only, never logged/written ---
  const sessionToken = await encode({
    secret,
    token: { name: BOT_USERNAME, role: BOT_ROLE, userId: String(botUserId), sub: String(botUserId) },
  });

  const browser = await chromium.launch({ headless: true });
  const url = new URL(BASE_URL);

  try {
    const context = await browser.newContext({ baseURL: BASE_URL });
    await context.addCookies([
      { name: "next-auth.session-token", value: sessionToken, domain: url.hostname, path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    const page = await context.newPage();

    let suiteHref = "";
    let runHref = "";

    await check("QA Dashboard loads for the authenticated session", async () => {
      await page.goto("/dashboard/qa");
      await assertVisible(page, page.getByRole("heading", { name: "QA Dashboard" }));
    });

    await check("create a project and test suite", async () => {
      await page.goto("/dashboard/qa/test-suites");
      await page.getByRole("button", { name: "New Test Suite" }).click();
      await page.getByRole("button", { name: "New" }).click();
      await page.getByLabel("Name").fill(PROJECT_NAME);
      await page.getByRole("button", { name: "Create Project" }).click();
      await assertVisible(page, page.getByText(`Project "${PROJECT_NAME}" created.`));

      const nameInputs = page.locator('input[maxlength="200"]');
      await nameInputs.last().fill(SUITE_NAME);
      await page.getByRole("button", { name: "Create Suite" }).click();
      await assertVisible(page, page.getByText(`Test suite "${SUITE_NAME}" created.`));

      const suiteLink = page.getByRole("link", { name: SUITE_NAME });
      await assertVisible(page, suiteLink);
      suiteHref = (await suiteLink.getAttribute("href")) ?? "";
      assert.ok(suiteHref.includes("/dashboard/qa/test-suites/"), `unexpected suite href: ${suiteHref}`);
    });

    await check("create a test case with steps under that suite", async () => {
      const suiteId = suiteHref.split("/").pop();
      await page.goto(`/dashboard/qa/test-cases/new?testSuiteId=${suiteId}`);
      await page.locator('input[maxlength="300"]').fill(CASE_TITLE);
      await page.getByRole("button", { name: "Add Step" }).click();
      await page.locator("textarea").first().fill("Open the login page");
      await page.getByRole("button", { name: "Create Test Case" }).click();
      await page.waitForURL(/\/dashboard\/qa\/test-cases\/\d+$/, { timeout: 15_000 });
      await assertVisible(page, page.getByText(CASE_TITLE));
    });

    await check("create a test run, add the case, assign the bot as tester", async () => {
      await page.goto("/dashboard/qa/test-runs");
      await page.getByRole("button", { name: "New Test Run" }).click();
      await page.locator("select").first().selectOption({ label: PROJECT_NAME });
      await page.locator('input[maxlength="200"]').fill(RUN_NAME);
      await page.getByRole("button", { name: "Create Test Run" }).click();
      await page.waitForTimeout(500);

      const runLink = page.getByRole("link", { name: /^TR-\d{5}$/ }).first();
      await assertVisible(page, runLink);
      runHref = (await runLink.getAttribute("href")) ?? "";
      await page.goto(runHref);

      await page.getByRole("button", { name: "Add Test Cases" }).click();
      await page.getByText(CASE_TITLE).click();
      await page.getByRole("button", { name: /^Add/ }).click();
      await page.waitForTimeout(500);

      const assignSelect = page.locator("table select").first();
      await assignSelect.selectOption({ label: BOT_USERNAME });
    });

    await check("execute the assigned case and mark it Failed", async () => {
      await page.goto("/dashboard/qa/execute");
      await page.getByText(CASE_TITLE).click();
      await page.waitForURL(/\/dashboard\/qa\/execute\/\d+$/, { timeout: 15_000 });
      await page.getByRole("button", { name: "Failed", exact: true }).click();
      await page.getByRole("button", { name: "Submit Result" }).click();
      await assertVisible(page, page.getByText("Result recorded: Failed."));
    });

    let bugHref = "";
    await check("file a bug from the failure, resolve it, then reopen it", async () => {
      await page.getByRole("link", { name: "File Bug from this Failure" }).click();
      await page.waitForURL(/\/dashboard\/qa\/bugs\?/, { timeout: 15_000 });
      await page.locator('input[maxlength="300"]').fill(BUG_TITLE);
      await page.getByRole("button", { name: "File Bug" }).click();
      await assertVisible(page, page.getByText(/Bug BUG-\d{5} filed\./));

      const bugLink = page.getByRole("link", { name: /^BUG-\d{5}$/ }).first();
      bugHref = (await bugLink.getAttribute("href")) ?? "";
      await page.goto(bugHref);
      await assertVisible(page, page.getByText(BUG_TITLE));

      await page.getByRole("button", { name: "Edit" }).click();
      await page.locator("select").nth(2).selectOption("Resolved");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await assertVisible(page, page.getByText("Bug updated."));

      await page.getByRole("button", { name: "Edit" }).click();
      await page.locator("select").nth(2).selectOption("Reopened");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await assertVisible(page, page.getByText("Bug updated."));
    });

    await check("complete the test run and confirm the dashboard reflects the new bug", async () => {
      await page.goto(runHref);
      await page.getByRole("button", { name: "Completed" }).click();
      await assertVisible(page, page.getByText("Run status set to Completed."));

      await page.goto("/dashboard/qa");
      await assertVisible(page, page.getByRole("heading", { name: "QA Dashboard" }));
      await assertVisible(page, page.getByText(BUG_TITLE));
    });

    if (failures > 0) {
      const shotPath = "e2e-failure.png";
      await page.screenshot({ path: shotPath, fullPage: true });
      console.log(`Saved failure screenshot to ${shotPath} (contains no credentials — page UI only).`);
    }
  } finally {
    await browser.close();
    const swept = await sweepData();
    console.log(`Swept DB: ${JSON.stringify(swept)}`);
    if (botUserId) {
      await db.request().input("id", sql.Int, botUserId).query("DELETE FROM Users WHERE Id = @id");
      console.log(`Deleted bot user id=${botUserId}.`);
    }
  }

  console.log(failures === 0 ? "\nAll E2E checks passed." : `\n${failures} E2E check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

async function assertVisible(page: Page, locator: ReturnType<Page["getByText"]>) {
  await locator.waitFor({ state: "visible", timeout: 10_000 });
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
