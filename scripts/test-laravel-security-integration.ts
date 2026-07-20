import "dotenv/config";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { getDb, sql } from "../src/lib/db";
import { runScan } from "../src/lib/laravelSecurity/runScan";

// DB/integration test for the Laravel Security module. Runs against the real configured
// database (no separate test DB exists for this app), so every row it creates is tagged with
// a unique marker and deleted in a `finally` block, in FK-safe child-before-parent order.
// Mirrors scripts/test-codequality-integration.ts, the established pattern for this app. Real
// scans run against real temp-directory PHP/.env fixtures on disk (no mocked analysis
// results) - REPO_SCAN_ROOTS (not the legacy CODE_QUALITY_SCAN_ROOTS) is temporarily narrowed
// to this script's own container directory for the duration of the run.
// RepoConnections CRUD/FK behavior itself (soft-delete, hard-delete -> SET NULL, provider
// checks) is already exhaustively covered by test-codequality-integration.ts since it's the
// same shared table every module points at - this script only confirms LaravelSecurityProjects
// wires up to that same table correctly, not the mechanism itself.

const MARKER = `__ls_integration_${Date.now()}__`;
let failures = 0;

function check(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
    } catch (err) {
      failures++;
      console.error(`  FAIL  ${name}`);
      console.error(`        ${err instanceof Error ? err.message : err}`);
    }
  })();
}

async function main() {
  const db = await getDb();

  const userRow = await db.request().query<{ Id: number }>("SELECT TOP 1 Id FROM Users ORDER BY Id");
  const userId = userRow.recordset[0]?.Id;
  if (!userId) throw new Error("No users found in Users table - cannot run integration test.");

  const created = { projectIds: [] as number[], connectionIds: [] as number[] };

  const previousRoots = process.env.REPO_SCAN_ROOTS;
  const containerDir = fs.mkdtempSync(path.join(os.tmpdir(), "ls-integration-container-"));
  process.env.REPO_SCAN_ROOTS = containerDir;

  let outsideDir = "";

  function makeTempDir(): string {
    return fs.mkdtempSync(path.join(containerDir, "fixture-"));
  }

  try {
    // --- project CRUD ---
    let projectId = 0;
    await check("creates a project row with defaults (Status='Active', DeletedAt=NULL)", async () => {
      const dir = makeTempDir();
      const result = await db
        .request()
        .input("name", sql.NVarChar, MARKER)
        .input("sourcePath", sql.NVarChar, dir)
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number; Status: string; DeletedAt: Date | null }>(`
          INSERT INTO LaravelSecurityProjects (Name, SourcePath, CreatedByUserId)
          OUTPUT INSERTED.Id, INSERTED.Status, INSERTED.DeletedAt
          VALUES (@name, @sourcePath, @createdBy)
        `);
      const row = result.recordset[0];
      projectId = row.Id;
      created.projectIds.push(projectId);
      assert.equal(row.Status, "Active");
      assert.equal(row.DeletedAt, null);
    });

    await check("updates a project's Name and Description", async () => {
      await db
        .request()
        .input("id", sql.Int, projectId)
        .input("name", sql.NVarChar, `${MARKER}-renamed`)
        .input("desc", sql.NVarChar, "integration test description")
        .query("UPDATE LaravelSecurityProjects SET Name = @name, Description = @desc, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
      const row = await db.request().input("id", sql.Int, projectId).query<{ Name: string; Description: string }>(
        "SELECT Name, Description FROM LaravelSecurityProjects WHERE Id = @id"
      );
      assert.equal(row.recordset[0].Name, `${MARKER}-renamed`);
      assert.equal(row.recordset[0].Description, "integration test description");
    });

    await check("soft-deletes a project by setting DeletedAt, and it disappears from an active-only query", async () => {
      const dir = makeTempDir();
      const insertResult = await db
        .request()
        .input("name", sql.NVarChar, `${MARKER}-softdelete`)
        .input("sourcePath", sql.NVarChar, dir)
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number }>(`
          INSERT INTO LaravelSecurityProjects (Name, SourcePath, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @createdBy)
        `);
      const softDeleteId = insertResult.recordset[0].Id;
      created.projectIds.push(softDeleteId);

      await db.request().input("id", sql.Int, softDeleteId).query("UPDATE LaravelSecurityProjects SET DeletedAt = SYSUTCDATETIME() WHERE Id = @id");

      const activeRows = await db.request().input("id", sql.Int, softDeleteId).query<{ Id: number }>(
        "SELECT Id FROM LaravelSecurityProjects WHERE Id = @id AND DeletedAt IS NULL"
      );
      assert.equal(activeRows.recordset.length, 0, "soft-deleted project must not appear in an active-only lookup");

      const anyRows = await db.request().input("id", sql.Int, softDeleteId).query<{ Id: number }>(
        "SELECT Id FROM LaravelSecurityProjects WHERE Id = @id"
      );
      assert.equal(anyRows.recordset.length, 1, "soft-deleted project row must still physically exist");
    });

    // --- real scan against a real PHP/.env fixture (no mocked analysis results) ---
    await check("runScan completes a real scan, persists a real AppDebug issue, and computes a security score below 100", async () => {
      const dir = makeTempDir();
      fs.writeFileSync(path.join(dir, ".env"), "APP_NAME=Fixture\nAPP_DEBUG=true\nAPP_KEY=base64:XyFixtureKey1234567890abcdefghijklmnop==\n");
      fs.writeFileSync(path.join(dir, "composer.json"), JSON.stringify({ require: { "laravel/framework": "^10.0" } }));

      const insertResult = await db
        .request()
        .input("name", sql.NVarChar, `${MARKER}-scan`)
        .input("sourcePath", sql.NVarChar, dir)
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number }>(`
          INSERT INTO LaravelSecurityProjects (Name, SourcePath, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @createdBy)
        `);
      const scanProjectId = insertResult.recordset[0].Id;
      created.projectIds.push(scanProjectId);

      const scanId = await runScan({ projectId: scanProjectId, startedByUserId: userId, scanType: "Full" });
      const scanRow = await db
        .request()
        .input("id", sql.Int, scanId)
        .query<{ Status: string; SecurityScore: number | null }>("SELECT Status, SecurityScore FROM LaravelSecurityScans WHERE Id = @id");
      const scan = scanRow.recordset[0];
      assert.equal(scan.Status, "Completed");
      assert.notEqual(scan.SecurityScore, null);
      assert.ok(scan.SecurityScore! < 100, "an APP_DEBUG=true fixture must deduct from a perfect score");

      const issues = await db.request().input("scanId", sql.Int, scanId).query<{ RuleCode: string }>(
        "SELECT RuleCode FROM LaravelSecurityIssues WHERE ScanId = @scanId"
      );
      assert.ok(
        issues.recordset.some((i) => i.RuleCode === "appdebug.enabled-in-env"),
        "expected a real appdebug.enabled-in-env issue from the fixture's .env"
      );

      const project = await db.request().input("id", sql.Int, scanProjectId).query<{ LaravelVersion: string | null }>(
        "SELECT LaravelVersion FROM LaravelSecurityProjects WHERE Id = @id"
      );
      assert.equal(project.recordset[0].LaravelVersion, "^10.0", "detectLaravel must persist the composer.json constraint onto the project row");
    });

    // --- empty-repo handling ---
    await check("runScan on an empty directory completes cleanly with zero files and a perfect score", async () => {
      const dir = makeTempDir(); // created, left empty
      const insertResult = await db
        .request()
        .input("name", sql.NVarChar, `${MARKER}-empty`)
        .input("sourcePath", sql.NVarChar, dir)
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number }>(`
          INSERT INTO LaravelSecurityProjects (Name, SourcePath, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @createdBy)
        `);
      const emptyProjectId = insertResult.recordset[0].Id;
      created.projectIds.push(emptyProjectId);

      const scanId = await runScan({ projectId: emptyProjectId, startedByUserId: userId, scanType: "Full" });
      const scanRow = await db
        .request()
        .input("id", sql.Int, scanId)
        .query<{ Status: string; FilesScanned: number; SecurityScore: number | null }>(
          "SELECT Status, FilesScanned, SecurityScore FROM LaravelSecurityScans WHERE Id = @id"
        );
      const scan = scanRow.recordset[0];
      assert.equal(scan.Status, "Completed", "an empty repo must still complete successfully, not fail or hang");
      assert.equal(scan.FilesScanned, 0);
      assert.equal(scan.SecurityScore, 100, "zero files/zero issues must score a perfect 100, not divide-by-zero into null/NaN");
    });

    // --- invalid path rejection ---
    await check("runScan marks the scan Failed (not Running forever) when SourcePath is outside the approved scan roots", async () => {
      outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "ls-integration-outside-"));

      const insertResult = await db
        .request()
        .input("name", sql.NVarChar, `${MARKER}-badpath`)
        .input("sourcePath", sql.NVarChar, outsideDir)
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number }>(`
          INSERT INTO LaravelSecurityProjects (Name, SourcePath, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @createdBy)
        `);
      const badPathProjectId = insertResult.recordset[0].Id;
      created.projectIds.push(badPathProjectId);

      const scanId = await runScan({ projectId: badPathProjectId, startedByUserId: userId, scanType: "Full" });
      const scanRow = await db
        .request()
        .input("id", sql.Int, scanId)
        .query<{ Status: string; ErrorMessage: string | null }>("SELECT Status, ErrorMessage FROM LaravelSecurityScans WHERE Id = @id");
      const scan = scanRow.recordset[0];
      assert.equal(scan.Status, "Failed");
      assert.match(scan.ErrorMessage ?? "", /outside the approved scan roots/);
    });

    // --- FK integrity: deleting a project cascades to its scans/issues ---
    await check("deleting a project cascades to its scans and issues (Project -> Scan -> Issues)", async () => {
      const dir = makeTempDir();
      fs.writeFileSync(path.join(dir, ".env"), "APP_DEBUG=true\n");
      const insertResult = await db
        .request()
        .input("name", sql.NVarChar, `${MARKER}-cascade`)
        .input("sourcePath", sql.NVarChar, dir)
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number }>(`
          INSERT INTO LaravelSecurityProjects (Name, SourcePath, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @createdBy)
        `);
      const cascadeProjectId = insertResult.recordset[0].Id;
      const scanId = await runScan({ projectId: cascadeProjectId, startedByUserId: userId, scanType: "Full" });

      await db.request().input("id", sql.Int, cascadeProjectId).query("DELETE FROM LaravelSecurityProjects WHERE Id = @id");

      const remainingScans = await db.request().input("id", sql.Int, scanId).query<{ Id: number }>("SELECT Id FROM LaravelSecurityScans WHERE Id = @id");
      assert.equal(remainingScans.recordset.length, 0, "scan must be gone after its project is deleted");

      const remainingIssues = await db.request().input("id", sql.Int, scanId).query<{ Id: number }>("SELECT Id FROM LaravelSecurityIssues WHERE ScanId = @id");
      assert.equal(remainingIssues.recordset.length, 0, "issues must be gone after their scan cascades away");
      // No teardown needed for this project - the DELETE above already removed it (and its cascade).
    });

    // --- shared RepoConnections wiring, specific to LaravelSecurityProjects ---
    await check("associates a LaravelSecurityProjects row with a shared RepoConnection, and a hard delete sets RepoConnectionId to NULL", async () => {
      const connResult = await db
        .request()
        .input("name", sql.NVarChar, `${MARKER}-connection`)
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number }>(`
          INSERT INTO RepoConnections (Provider, Name, AuthMethod, OwnerLogin, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES ('GitHub', @name, 'PAT', 'octocat', @createdBy)
        `);
      const connectionId = connResult.recordset[0].Id;
      created.connectionIds.push(connectionId);

      const dir = makeTempDir();
      const insertResult = await db
        .request()
        .input("name", sql.NVarChar, `${MARKER}-github-project`)
        .input("sourcePath", sql.NVarChar, dir)
        .input("connectionId", sql.Int, connectionId)
        .input("owner", sql.NVarChar, "octocat")
        .input("repo", sql.NVarChar, "hello-world")
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number }>(`
          INSERT INTO LaravelSecurityProjects (Name, SourcePath, RepoConnectionId, RepoProvider, RepositoryOwner, RepositoryName, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @connectionId, 'GitHub', @owner, @repo, @createdBy)
        `);
      const ghProjectId = insertResult.recordset[0].Id;
      created.projectIds.push(ghProjectId);

      await db.request().input("id", sql.Int, connectionId).query("DELETE FROM RepoConnections WHERE Id = @id");
      created.connectionIds = created.connectionIds.filter((id) => id !== connectionId);

      const project = await db.request().input("id", sql.Int, ghProjectId).query<{ RepoConnectionId: number | null }>(
        "SELECT RepoConnectionId FROM LaravelSecurityProjects WHERE Id = @id"
      );
      assert.equal(project.recordset[0].RepoConnectionId, null);
    });
  } finally {
    // --- teardown, FK-safe (deleting a project cascades to its own scans/issues) ---
    for (const id of created.projectIds) {
      await db.request().input("id", sql.Int, id).query("DELETE FROM LaravelSecurityProjects WHERE Id = @id").catch(() => {});
    }
    // Belt-and-braces sweep for any marker-tagged rows a failed assertion left behind.
    const leftovers = await db.request().input("marker", sql.NVarChar, `${MARKER}%`).query<{ Id: number }>(
      "SELECT Id FROM LaravelSecurityProjects WHERE Name LIKE @marker"
    );
    for (const row of leftovers.recordset) {
      await db.request().input("id", sql.Int, row.Id).query("DELETE FROM LaravelSecurityProjects WHERE Id = @id").catch(() => {});
    }

    for (const id of created.connectionIds) {
      await db.request().input("id", sql.Int, id).query("DELETE FROM RepoConnections WHERE Id = @id").catch(() => {});
    }
    const leftoverConnections = await db.request().input("marker", sql.NVarChar, `${MARKER}%`).query<{ Id: number }>(
      "SELECT Id FROM RepoConnections WHERE Name LIKE @marker"
    );
    for (const row of leftoverConnections.recordset) {
      await db.request().input("id", sql.Int, row.Id).query("DELETE FROM RepoConnections WHERE Id = @id").catch(() => {});
    }

    fs.rmSync(containerDir, { recursive: true, force: true });
    if (outsideDir) fs.rmSync(outsideDir, { recursive: true, force: true });
    if (previousRoots === undefined) delete process.env.REPO_SCAN_ROOTS;
    else process.env.REPO_SCAN_ROOTS = previousRoots;
  }

  console.log(failures === 0 ? "\nAll Laravel Security integration checks passed." : `\n${failures} Laravel Security integration check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
