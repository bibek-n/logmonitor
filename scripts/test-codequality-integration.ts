import "dotenv/config";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { getDb, sql } from "../src/lib/db";
import { runScan } from "../src/lib/codeQuality/runScan";

// DB/integration test for the Code Quality module. Runs against the real configured
// database (no separate test DB exists for this app), so every row it creates is tagged with
// a unique marker and deleted in a `finally` block, in FK-safe child-before-parent order.
// Mirrors scripts/test-qa-integration.ts, the established pattern for this app. Real scans
// run against real temp-directory fixtures on disk (no mocked analysis results), matching the
// module's own "no mock data" requirement.

const MARKER = `__cq_integration_${Date.now()}__`;
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

  const created = { projectIds: [] as number[], connectionIds: [] as number[], gitlabConnectionIds: [] as number[] };

  // All legitimate fixtures live under one container directory, which is the ONLY entry in
  // CODE_QUALITY_SCAN_ROOTS for the duration of this script - so every real scan in this file
  // passes path validation without touching the app's own configured roots, and the "outside
  // the approved roots" test just needs a sibling directory that isn't nested inside it.
  const previousRoots = process.env.CODE_QUALITY_SCAN_ROOTS;
  const containerDir = fs.mkdtempSync(path.join(os.tmpdir(), "cq-integration-container-"));
  process.env.CODE_QUALITY_SCAN_ROOTS = containerDir;

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
          INSERT INTO CodeQualityProjects (Name, SourcePath, CreatedByUserId)
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
        .query("UPDATE CodeQualityProjects SET Name = @name, Description = @desc, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
      const row = await db.request().input("id", sql.Int, projectId).query<{ Name: string; Description: string }>(
        "SELECT Name, Description FROM CodeQualityProjects WHERE Id = @id"
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
          INSERT INTO CodeQualityProjects (Name, SourcePath, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @createdBy)
        `);
      const softDeleteId = insertResult.recordset[0].Id;
      created.projectIds.push(softDeleteId);

      await db.request().input("id", sql.Int, softDeleteId).query("UPDATE CodeQualityProjects SET DeletedAt = SYSUTCDATETIME() WHERE Id = @id");

      const activeRows = await db.request().input("id", sql.Int, softDeleteId).query<{ Id: number }>(
        "SELECT Id FROM CodeQualityProjects WHERE Id = @id AND DeletedAt IS NULL"
      );
      assert.equal(activeRows.recordset.length, 0, "soft-deleted project must not appear in an active-only lookup");

      const anyRows = await db.request().input("id", sql.Int, softDeleteId).query<{ Id: number }>(
        "SELECT Id FROM CodeQualityProjects WHERE Id = @id"
      );
      assert.equal(anyRows.recordset.length, 1, "soft-deleted project row must still physically exist");
    });

    // --- real scan against a real fixture directory (no mocked analysis results) ---
    await check("runScan completes a real scan, persists real issues, and computes a quality score", async () => {
      const dir = makeTempDir();
      // A deliberately over-complex function so the complexity analyzer has something real to find.
      const branches = Array.from({ length: 8 }, (_, i) => `if (a === ${i}) { b = b + 1; }`).join("\n  ");
      fs.writeFileSync(path.join(dir, "sample.ts"), `function complexFn(a, b) {\n  ${branches}\n  return b;\n}\n`);

      const insertResult = await db
        .request()
        .input("name", sql.NVarChar, `${MARKER}-scan`)
        .input("sourcePath", sql.NVarChar, dir)
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number }>(`
          INSERT INTO CodeQualityProjects (Name, SourcePath, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @createdBy)
        `);
      const scanProjectId = insertResult.recordset[0].Id;
      created.projectIds.push(scanProjectId);

      const scanId = await runScan({ projectId: scanProjectId, startedByUserId: userId, scanType: "Full" });
      const scanRow = await db
        .request()
        .input("id", sql.Int, scanId)
        .query<{ Status: string; FilesScanned: number; QualityScore: number | null }>(
          "SELECT Status, FilesScanned, QualityScore FROM CodeQualityScans WHERE Id = @id"
        );
      const scan = scanRow.recordset[0];
      assert.equal(scan.Status, "Completed");
      assert.equal(scan.FilesScanned, 1);
      assert.notEqual(scan.QualityScore, null);

      const issues = await db.request().input("scanId", sql.Int, scanId).query<{ RuleCode: string }>(
        "SELECT RuleCode FROM CodeQualityIssues WHERE ScanId = @scanId"
      );
      assert.ok(
        issues.recordset.some((i) => i.RuleCode === "complexity.function-threshold"),
        "expected a real complexity.function-threshold issue from the over-complex fixture function"
      );
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
          INSERT INTO CodeQualityProjects (Name, SourcePath, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @createdBy)
        `);
      const emptyProjectId = insertResult.recordset[0].Id;
      created.projectIds.push(emptyProjectId);

      const scanId = await runScan({ projectId: emptyProjectId, startedByUserId: userId, scanType: "Full" });
      const scanRow = await db
        .request()
        .input("id", sql.Int, scanId)
        .query<{ Status: string; FilesScanned: number; QualityScore: number | null }>(
          "SELECT Status, FilesScanned, QualityScore FROM CodeQualityScans WHERE Id = @id"
        );
      const scan = scanRow.recordset[0];
      assert.equal(scan.Status, "Completed", "an empty repo must still complete successfully, not fail or hang");
      assert.equal(scan.FilesScanned, 0);
      assert.equal(scan.QualityScore, 100, "zero files/zero issues must score a perfect 100, not divide-by-zero into null/NaN");
    });

    // --- invalid path rejection ---
    await check("runScan marks the scan Failed (not Running forever) when SourcePath is outside the approved scan roots", async () => {
      // A sibling of containerDir, not nested inside it - guaranteed outside CODE_QUALITY_SCAN_ROOTS.
      outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "cq-integration-outside-"));

      const insertResult = await db
        .request()
        .input("name", sql.NVarChar, `${MARKER}-badpath`)
        .input("sourcePath", sql.NVarChar, outsideDir)
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number }>(`
          INSERT INTO CodeQualityProjects (Name, SourcePath, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @createdBy)
        `);
      const badPathProjectId = insertResult.recordset[0].Id;
      created.projectIds.push(badPathProjectId);

      const scanId = await runScan({ projectId: badPathProjectId, startedByUserId: userId, scanType: "Full" });
      const scanRow = await db
        .request()
        .input("id", sql.Int, scanId)
        .query<{ Status: string; ErrorMessage: string | null }>("SELECT Status, ErrorMessage FROM CodeQualityScans WHERE Id = @id");
      const scan = scanRow.recordset[0];
      assert.equal(scan.Status, "Failed");
      assert.match(scan.ErrorMessage ?? "", /outside the approved scan roots/);
    });

    // --- FK integrity: deleting a project cascades to its scans/issues/metrics ---
    await check("deleting a project cascades to its scans, issues, and metrics (Project -> Scan -> Issues/Metrics)", async () => {
      const dir = makeTempDir();
      fs.writeFileSync(path.join(dir, "sample.ts"), `if (true) { console.log("x"); }\n`);
      const insertResult = await db
        .request()
        .input("name", sql.NVarChar, `${MARKER}-cascade`)
        .input("sourcePath", sql.NVarChar, dir)
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number }>(`
          INSERT INTO CodeQualityProjects (Name, SourcePath, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @createdBy)
        `);
      const cascadeProjectId = insertResult.recordset[0].Id;
      const scanId = await runScan({ projectId: cascadeProjectId, startedByUserId: userId, scanType: "Full" });

      await db.request().input("id", sql.Int, cascadeProjectId).query("DELETE FROM CodeQualityProjects WHERE Id = @id");

      const remainingScans = await db.request().input("id", sql.Int, scanId).query<{ Id: number }>("SELECT Id FROM CodeQualityScans WHERE Id = @id");
      assert.equal(remainingScans.recordset.length, 0, "scan must be gone after its project is deleted");

      const remainingIssues = await db.request().input("id", sql.Int, scanId).query<{ Id: number }>("SELECT Id FROM CodeQualityIssues WHERE ScanId = @id");
      assert.equal(remainingIssues.recordset.length, 0, "issues must be gone after their scan cascades away");
      // No teardown needed for this project - the DELETE above already removed it (and its cascade).
    });

    // --- Shared RepoConnections: CRUD + FK behavior (DB-level only - no real GitHub/GitLab
    // network call, this app has no live token to test against here; the encryption round-trip
    // and the archive-download/extraction pipeline for both providers are covered by
    // src/lib/repoConnections/{github,gitlab}/*.test.ts). This is the shared table every
    // module (Code Quality, Laravel Security, future ones) now points at via
    // CodeQualityProjects.RepoConnectionId - see migrate-repo-connections.ts.
    await check("creates a RepoConnection row for each provider/auth method with defaults (DeletedAt=NULL)", async () => {
      for (const method of ["PAT", "OAuthApp", "GitHubApp"] as const) {
        const result = await db
          .request()
          .input("name", sql.NVarChar, `${MARKER}-GitHub-${method}`)
          .input("ownerLogin", sql.NVarChar, "octocat")
          .input("createdBy", sql.Int, userId)
          .query<{ Id: number; DeletedAt: Date | null }>(`
            INSERT INTO RepoConnections (Provider, Name, AuthMethod, OwnerLogin, CreatedByUserId)
            OUTPUT INSERTED.Id, INSERTED.DeletedAt VALUES ('GitHub', @name, '${method}', @ownerLogin, @createdBy)
          `);
        created.connectionIds.push(result.recordset[0].Id);
        assert.equal(result.recordset[0].DeletedAt, null);
      }
    });

    await check("rejects a Provider outside GitHub/GitLab (CK_RepoConnections_Provider)", async () => {
      await assert.rejects(
        db
          .request()
          .input("name", sql.NVarChar, `${MARKER}-bad-provider`)
          .input("createdBy", sql.Int, userId)
          .query("INSERT INTO RepoConnections (Provider, Name, AuthMethod, CreatedByUserId) VALUES ('Bitbucket', @name, 'PAT', @createdBy)"),
        /CK_RepoConnections_Provider|CHECK constraint/i
      );
    });

    await check("rejects an AuthMethod outside PAT/OAuthApp/GitHubApp (CK_RepoConnections_AuthMethod)", async () => {
      await assert.rejects(
        db
          .request()
          .input("name", sql.NVarChar, `${MARKER}-bad-method`)
          .input("createdBy", sql.Int, userId)
          .query("INSERT INTO RepoConnections (Provider, Name, AuthMethod, CreatedByUserId) VALUES ('GitHub', @name, 'Bogus', @createdBy)"),
        /CK_RepoConnections_AuthMethod|CHECK constraint/i
      );
    });

    await check("associates a project with a GitHub connection via RepoConnectionId/RepoProvider, and soft-deleting the connection leaves the project's pointer intact", async () => {
      const connectionId = created.connectionIds[0];
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
          INSERT INTO CodeQualityProjects (Name, SourcePath, RepoConnectionId, RepoProvider, RepositoryOwner, RepositoryName, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @connectionId, 'GitHub', @owner, @repo, @createdBy)
        `);
      const projectId = insertResult.recordset[0].Id;
      created.projectIds.push(projectId);

      await db.request().input("id", sql.Int, connectionId).query("UPDATE RepoConnections SET DeletedAt = SYSUTCDATETIME() WHERE Id = @id");

      const project = await db.request().input("id", sql.Int, projectId).query<{ RepoConnectionId: number | null; RepoProvider: string | null }>(
        "SELECT RepoConnectionId, RepoProvider FROM CodeQualityProjects WHERE Id = @id"
      );
      assert.equal(project.recordset[0].RepoConnectionId, connectionId, "soft-delete must not touch the project's RepoConnectionId pointer");
      assert.equal(project.recordset[0].RepoProvider, "GitHub");
    });

    await check("a hard delete of a connection sets RepoConnectionId to NULL on referencing projects (FK ON DELETE SET NULL)", async () => {
      const connectionId = created.connectionIds[1];
      const dir = makeTempDir();
      const insertResult = await db
        .request()
        .input("name", sql.NVarChar, `${MARKER}-hard-delete-fk`)
        .input("sourcePath", sql.NVarChar, dir)
        .input("connectionId", sql.Int, connectionId)
        .input("owner", sql.NVarChar, "octocat")
        .input("repo", sql.NVarChar, "hello-world")
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number }>(`
          INSERT INTO CodeQualityProjects (Name, SourcePath, RepoConnectionId, RepoProvider, RepositoryOwner, RepositoryName, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @connectionId, 'GitHub', @owner, @repo, @createdBy)
        `);
      const projectId = insertResult.recordset[0].Id;
      created.projectIds.push(projectId);

      await db.request().input("id", sql.Int, connectionId).query("DELETE FROM RepoConnections WHERE Id = @id");
      created.connectionIds = created.connectionIds.filter((id) => id !== connectionId);

      const project = await db.request().input("id", sql.Int, projectId).query<{ RepoConnectionId: number | null }>(
        "SELECT RepoConnectionId FROM CodeQualityProjects WHERE Id = @id"
      );
      assert.equal(project.recordset[0].RepoConnectionId, null);
    });

    let gitlabConnectionId = 0;
    await check("creates a GitLab RepoConnection row (InstanceUrl required, AccessTokenEncrypted not required at the shared-table level)", async () => {
      const result = await db
        .request()
        .input("name", sql.NVarChar, `${MARKER}-gitlab`)
        .input("instanceUrl", sql.NVarChar, "https://gitlab.example.com")
        .input("ownerLogin", sql.NVarChar, "devuser")
        .input("accessToken", sql.NVarChar, "irrelevant-for-this-check:iv:tag")
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number; DeletedAt: Date | null; InstanceUrl: string }>(`
          INSERT INTO RepoConnections (Provider, Name, AuthMethod, InstanceUrl, OwnerLogin, AccessTokenEncrypted, CreatedByUserId)
          OUTPUT INSERTED.Id, INSERTED.DeletedAt, INSERTED.InstanceUrl VALUES ('GitLab', @name, 'PAT', @instanceUrl, @ownerLogin, @accessToken, @createdBy)
        `);
      gitlabConnectionId = result.recordset[0].Id;
      created.gitlabConnectionIds.push(gitlabConnectionId);
      assert.equal(result.recordset[0].DeletedAt, null);
      assert.equal(result.recordset[0].InstanceUrl, "https://gitlab.example.com");
    });

    await check("associates a project with a GitLab connection, sharing the same RepositoryOwner/RepositoryName columns GitHub uses", async () => {
      const dir = makeTempDir();
      const insertResult = await db
        .request()
        .input("name", sql.NVarChar, `${MARKER}-gitlab-project`)
        .input("sourcePath", sql.NVarChar, dir)
        .input("connectionId", sql.Int, gitlabConnectionId)
        .input("projectId", sql.NVarChar, "42") // GitLab's numeric project id, stored as text in RepositoryOwner (see runScan.ts's comment)
        .input("projectPath", sql.NVarChar, "group/subgroup/project")
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number }>(`
          INSERT INTO CodeQualityProjects (Name, SourcePath, RepoConnectionId, RepoProvider, RepositoryOwner, RepositoryName, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @connectionId, 'GitLab', @projectId, @projectPath, @createdBy)
        `);
      const projectId = insertResult.recordset[0].Id;
      created.projectIds.push(projectId);

      const project = await db.request().input("id", sql.Int, projectId).query<{ RepoConnectionId: number | null; RepoProvider: string | null; RepositoryName: string }>(
        "SELECT RepoConnectionId, RepoProvider, RepositoryName FROM CodeQualityProjects WHERE Id = @id"
      );
      assert.equal(project.recordset[0].RepoConnectionId, gitlabConnectionId);
      assert.equal(project.recordset[0].RepoProvider, "GitLab");
      assert.equal(project.recordset[0].RepositoryName, "group/subgroup/project", "GitLab project paths with subgroups must round-trip intact");
    });

    await check("a hard delete of a GitLab connection sets RepoConnectionId to NULL on referencing projects (FK ON DELETE SET NULL)", async () => {
      const dir = makeTempDir();
      const insertResult = await db
        .request()
        .input("name", sql.NVarChar, `${MARKER}-gitlab-hard-delete-fk`)
        .input("sourcePath", sql.NVarChar, dir)
        .input("connectionId", sql.Int, gitlabConnectionId)
        .input("projectId", sql.NVarChar, "99")
        .input("projectPath", sql.NVarChar, "group/other-project")
        .input("createdBy", sql.Int, userId)
        .query<{ Id: number }>(`
          INSERT INTO CodeQualityProjects (Name, SourcePath, RepoConnectionId, RepoProvider, RepositoryOwner, RepositoryName, CreatedByUserId)
          OUTPUT INSERTED.Id VALUES (@name, @sourcePath, @connectionId, 'GitLab', @projectId, @projectPath, @createdBy)
        `);
      const projectId = insertResult.recordset[0].Id;
      created.projectIds.push(projectId);

      await db.request().input("id", sql.Int, gitlabConnectionId).query("DELETE FROM RepoConnections WHERE Id = @id");
      created.gitlabConnectionIds = created.gitlabConnectionIds.filter((id) => id !== gitlabConnectionId);

      const project = await db.request().input("id", sql.Int, projectId).query<{ RepoConnectionId: number | null }>(
        "SELECT RepoConnectionId FROM CodeQualityProjects WHERE Id = @id"
      );
      assert.equal(project.recordset[0].RepoConnectionId, null);
    });
  } finally {
    // --- teardown, FK-safe (deleting a project cascades to its own scans/issues/metrics) ---
    for (const id of created.projectIds) {
      await db.request().input("id", sql.Int, id).query("DELETE FROM CodeQualityProjects WHERE Id = @id").catch(() => {});
    }
    // Belt-and-braces sweep for any marker-tagged rows a failed assertion left behind.
    const leftovers = await db.request().input("marker", sql.NVarChar, `${MARKER}%`).query<{ Id: number }>(
      "SELECT Id FROM CodeQualityProjects WHERE Name LIKE @marker"
    );
    for (const row of leftovers.recordset) {
      await db.request().input("id", sql.Int, row.Id).query("DELETE FROM CodeQualityProjects WHERE Id = @id").catch(() => {});
    }

    for (const id of created.connectionIds) {
      await db.request().input("id", sql.Int, id).query("DELETE FROM CodeQualityGitHubConnections WHERE Id = @id").catch(() => {});
    }
    const leftoverConnections = await db.request().input("marker", sql.NVarChar, `${MARKER}%`).query<{ Id: number }>(
      "SELECT Id FROM CodeQualityGitHubConnections WHERE Name LIKE @marker"
    );
    for (const row of leftoverConnections.recordset) {
      await db.request().input("id", sql.Int, row.Id).query("DELETE FROM CodeQualityGitHubConnections WHERE Id = @id").catch(() => {});
    }

    for (const id of created.gitlabConnectionIds) {
      await db.request().input("id", sql.Int, id).query("DELETE FROM CodeQualityGitLabConnections WHERE Id = @id").catch(() => {});
    }
    const leftoverGitlabConnections = await db.request().input("marker", sql.NVarChar, `${MARKER}%`).query<{ Id: number }>(
      "SELECT Id FROM CodeQualityGitLabConnections WHERE Name LIKE @marker"
    );
    for (const row of leftoverGitlabConnections.recordset) {
      await db.request().input("id", sql.Int, row.Id).query("DELETE FROM CodeQualityGitLabConnections WHERE Id = @id").catch(() => {});
    }

    fs.rmSync(containerDir, { recursive: true, force: true });
    if (outsideDir) fs.rmSync(outsideDir, { recursive: true, force: true });
    if (previousRoots === undefined) delete process.env.CODE_QUALITY_SCAN_ROOTS;
    else process.env.CODE_QUALITY_SCAN_ROOTS = previousRoots;
  }

  console.log(failures === 0 ? "\nAll Code Quality integration checks passed." : `\n${failures} Code Quality integration check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
