import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import { withReferenceNumber } from "../src/lib/qaReferenceNumbers";

async function main() {
  const db = await getDb();

  const projectRow = await db.query<{ Id: number }>`SELECT TOP 1 Id FROM QaProjects WHERE Name = 'Build Up Nepal'`;
  const projectId = projectRow.recordset[0]?.Id;
  if (!projectId) throw new Error("Build Up Nepal QA project not found — run the QA seed script first.");

  const adminRow = await db.query<{ Id: number }>`SELECT TOP 1 Id FROM Users WHERE Role = 'Admin' ORDER BY Id ASC`;
  const adminId = adminRow.recordset[0]?.Id;
  if (!adminId) throw new Error("No Admin user found.");

  // Attach to the "Automated Unit Tests (Vitest)" suite's automation module (dependency
  // hygiene is closest in spirit to the automated-tooling area of this project).
  const suiteRow = await db.query<{ Id: number }>`SELECT TOP 1 Id FROM QaTestSuites WHERE ProjectId = ${projectId} AND Name LIKE 'Automated Unit Tests%'`;
  const suiteId = suiteRow.recordset[0]?.Id ?? null;

  const bug = await withReferenceNumber("QaBugs", "BugNumber", "BUG", async (transaction, bugNumber) => {
    const r = await new sql.Request(transaction)
      .input("bugNumber", sql.VarChar, bugNumber)
      .input("title", sql.NVarChar, "npm audit: dependency vulnerabilities (was 1 critical, 19 high — now 0 critical, 16 high after partial fix)")
      .input("description", sql.NVarChar,
`A full \`npm audit\` against the repo found 35 advisories (2 low, 13 moderate, 19 high, 1 critical). Full breakdown by real exposure:

CRITICAL (fixed): vitest <3.2.6 (direct devDependency, was ^3.2.4) — GHSA-5xrq-8626-4rwp, CVSS 9.8. When Vitest's UI server is listening, an attacker who can reach it can read/execute arbitrary files. Never shipped to production; only exploitable if \`vitest --ui\` is run with that server exposed beyond localhost (e.g. an unlocked CI box).

HIGH, shipped to the live app (fixed): react-router-dom 6.30.1 (direct dependency, used for all app routing including ProtectedRoute) pulled in @remix-run/router <=1.23.1 with two open-redirect/XSS advisories — GHSA-2w69-qvjg-hvjx (CVSS 8) and GHSA-9jcx-v3wj-wh4m (CVSS 6.5).

HIGH, shipped to the live app (NOT fixed, needs a breaking-change review): vite 5.4.19 (direct dependency, build tool) — several path-traversal advisories, all scoped to the dev server's file-serving behavior (server.fs.deny bypass, optimized-deps .map path traversal), not the built production bundle. Real risk only if \`vite dev\`/\`vite preview\` is ever reachable beyond localhost. Fixing means moving to Vite 6.x, which needs compatibility review with vite-plugin-pwa and other plugins before it's safe to bump.

HIGH, narrow blast radius (NOT fixed, needs upstream): axios, lodash, immutable all arrive transitively via swagger-ui-react, which powers /api-docs. Confirmed that page is code-split (lazyWithRetry) — its ~1.29MB chunk only downloads when a user actually visits /api-docs, so exposure is isolated to that one page, not the main app bundle. Can't be fixed independently of swagger-ui-react publishing an update. Worth separately deciding whether /api-docs should ship in production at all.

HIGH (NOT fixed, exposure depends on usage): ws — transitive via @supabase/supabase-js's realtime client (relevant only if the app actually uses Supabase Realtime subscriptions) and via jsdom (test-only, never shipped).

HIGH/MODERATE, build-tooling only (not prioritized): rollup, esbuild (via vite), glob, minimatch, picomatch, tmp, serialize-javascript, flatted, @babel/plugin-transform-modules-systemjs — none of these reach the shipped browser bundle.

Note: this repo's real package manager is bun (bun.lockb present), not npm. The two fixes below were applied via npm (only npm/Node were available in the environment they were made in) — package-lock.json was regenerated but bun.lock was NOT touched, so it needs \`bun install\` run once to resync, or the same version bumps re-applied via bun directly.`)
      .input("stepsToReproduce", sql.NVarChar, "1. Clone the repo. 2. Run `npm install`. 3. Run `npm audit`.")
      .input("expectedResult", sql.NVarChar, "No critical advisories; high-severity advisories on direct, production-shipped dependencies addressed or explicitly triaged.")
      .input("actualResult", sql.NVarChar, "1 critical (vitest) and 19 high (led by react-router-dom/@remix-run/router) on a fresh install. After this bug's partial fix: 0 critical, 16 high remaining (vite dev-server-only advisories, swagger-ui-react's transitive deps, ws).")
      .input("projectId", sql.Int, projectId)
      .input("severity", sql.VarChar, "Critical")
      .input("priority", sql.VarChar, "High")
      .input("reporterUserId", sql.Int, adminId)
      .input("assignedDeveloperUserId", sql.Int, adminId)
      .query<{ Id: number; BugNumber: string }>(`
        INSERT INTO QaBugs (
          BugNumber, Title, Description, StepsToReproduce, ExpectedResult, ActualResult,
          ProjectId, TestCaseId, Severity, Priority, ReporterUserId, AssignedDeveloperUserId, Status
        )
        OUTPUT INSERTED.Id, INSERTED.BugNumber
        VALUES (
          @bugNumber, @title, @description, @stepsToReproduce, @expectedResult, @actualResult,
          @projectId, NULL, @severity, @priority, @reporterUserId, @assignedDeveloperUserId, 'In Progress'
        )
      `);
    return r.recordset[0];
  });

  console.log(`Bug filed: ${bug.BugNumber} (Id ${bug.Id}), Status=In Progress, TestSuiteId=${suiteId}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
