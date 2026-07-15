import "dotenv/config";
import { getDb } from "../src/lib/db";

// Adds the "structural core" of a TestRail/Zephyr-style QA tool on top of the existing module
// (Projects/Suites/Cases/Runs/Bugs/Releases): Requirements (+ traceability link to test
// cases), Test Plans (a wrapper over multiple test runs), Milestones (a wrapper over multiple
// test plans), and real Environment/Build entities to replace the free-text
// QaTestRuns.Environment/DeployedBuildVersion columns going forward. Every new table follows
// this app's existing conventions: Id INT IDENTITY(1,1), named FK/index constraints, no
// ON DELETE CASCADE, SYSUTCDATETIME() defaults, IF NOT EXISTS guards. No hard deletes are
// introduced — every new entity uses a Status lifecycle instead, matching every other QA table.

async function main() {
  const db = await getDb();

  // --- Requirements ---
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='QaRequirements' AND xtype='U')
    CREATE TABLE QaRequirements (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      RequirementNumber VARCHAR(20) NOT NULL UNIQUE,
      ProjectId INT NOT NULL,
      Title NVARCHAR(300) NOT NULL,
      Description NVARCHAR(MAX) NULL,
      Category NVARCHAR(50) NULL,
      Priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
      Status VARCHAR(20) NOT NULL DEFAULT 'New',
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_QaRequirements_QaProjects FOREIGN KEY (ProjectId) REFERENCES QaProjects(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_QaRequirements_ProjectId')
    CREATE INDEX IX_QaRequirements_ProjectId ON QaRequirements (ProjectId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='QaRequirementTestCases' AND xtype='U')
    CREATE TABLE QaRequirementTestCases (
      RequirementId INT NOT NULL,
      TestCaseId INT NOT NULL,
      CONSTRAINT PK_QaRequirementTestCases PRIMARY KEY (RequirementId, TestCaseId),
      CONSTRAINT FK_QaRequirementTestCases_QaRequirements FOREIGN KEY (RequirementId) REFERENCES QaRequirements(Id),
      CONSTRAINT FK_QaRequirementTestCases_QaTestCases FOREIGN KEY (TestCaseId) REFERENCES QaTestCases(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_QaRequirementTestCases_TestCaseId')
    CREATE INDEX IX_QaRequirementTestCases_TestCaseId ON QaRequirementTestCases (TestCaseId)
  `;
  console.log("QaRequirements + QaRequirementTestCases ready.");

  // --- Test Plans ---
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='QaTestPlans' AND xtype='U')
    CREATE TABLE QaTestPlans (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      TestPlanNumber VARCHAR(20) NOT NULL UNIQUE,
      ProjectId INT NOT NULL,
      ReleaseId INT NULL,
      Name NVARCHAR(200) NOT NULL,
      Description NVARCHAR(1000) NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Planned',
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_QaTestPlans_QaProjects FOREIGN KEY (ProjectId) REFERENCES QaProjects(Id),
      CONSTRAINT FK_QaTestPlans_QaReleases FOREIGN KEY (ReleaseId) REFERENCES QaReleases(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_QaTestPlans_ProjectId')
    CREATE INDEX IX_QaTestPlans_ProjectId ON QaTestPlans (ProjectId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='QaTestPlanRuns' AND xtype='U')
    CREATE TABLE QaTestPlanRuns (
      TestPlanId INT NOT NULL,
      TestRunId INT NOT NULL,
      CONSTRAINT PK_QaTestPlanRuns PRIMARY KEY (TestPlanId, TestRunId),
      CONSTRAINT FK_QaTestPlanRuns_QaTestPlans FOREIGN KEY (TestPlanId) REFERENCES QaTestPlans(Id),
      CONSTRAINT FK_QaTestPlanRuns_QaTestRuns FOREIGN KEY (TestRunId) REFERENCES QaTestRuns(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_QaTestPlanRuns_TestRunId')
    CREATE INDEX IX_QaTestPlanRuns_TestRunId ON QaTestPlanRuns (TestRunId)
  `;
  console.log("QaTestPlans + QaTestPlanRuns ready.");

  // --- Milestones ---
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='QaMilestones' AND xtype='U')
    CREATE TABLE QaMilestones (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ProjectId INT NOT NULL,
      ReleaseId INT NULL,
      Name NVARCHAR(200) NOT NULL,
      MilestoneType VARCHAR(20) NOT NULL DEFAULT 'Sprint',
      DueDate DATE NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Planned',
      Description NVARCHAR(1000) NULL,
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_QaMilestones_QaProjects FOREIGN KEY (ProjectId) REFERENCES QaProjects(Id),
      CONSTRAINT FK_QaMilestones_QaReleases FOREIGN KEY (ReleaseId) REFERENCES QaReleases(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_QaMilestones_ProjectId')
    CREATE INDEX IX_QaMilestones_ProjectId ON QaMilestones (ProjectId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='QaMilestoneTestPlans' AND xtype='U')
    CREATE TABLE QaMilestoneTestPlans (
      MilestoneId INT NOT NULL,
      TestPlanId INT NOT NULL,
      CONSTRAINT PK_QaMilestoneTestPlans PRIMARY KEY (MilestoneId, TestPlanId),
      CONSTRAINT FK_QaMilestoneTestPlans_QaMilestones FOREIGN KEY (MilestoneId) REFERENCES QaMilestones(Id),
      CONSTRAINT FK_QaMilestoneTestPlans_QaTestPlans FOREIGN KEY (TestPlanId) REFERENCES QaTestPlans(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_QaMilestoneTestPlans_TestPlanId')
    CREATE INDEX IX_QaMilestoneTestPlans_TestPlanId ON QaMilestoneTestPlans (TestPlanId)
  `;
  console.log("QaMilestones + QaMilestoneTestPlans ready.");

  // --- Environments ---
  // Descriptive fields only — this is a public repo, so no real credentials/secrets belong
  // in ApiUrl/DatabaseInfo/ConfigNotes, just human-readable references (e.g. a URL with no
  // embedded token, "staging replica, refreshed nightly").
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='QaEnvironments' AND xtype='U')
    CREATE TABLE QaEnvironments (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ProjectId INT NOT NULL,
      Name NVARCHAR(100) NOT NULL,
      ApiUrl NVARCHAR(300) NULL,
      DatabaseInfo NVARCHAR(300) NULL,
      BuildVersion NVARCHAR(100) NULL,
      ConfigNotes NVARCHAR(1000) NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_QaEnvironments_QaProjects FOREIGN KEY (ProjectId) REFERENCES QaProjects(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_QaEnvironments_ProjectId')
    CREATE INDEX IX_QaEnvironments_ProjectId ON QaEnvironments (ProjectId)
  `;
  console.log("QaEnvironments ready.");

  // --- Builds ---
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='QaBuilds' AND xtype='U')
    CREATE TABLE QaBuilds (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ProjectId INT NOT NULL,
      ReleaseId INT NULL,
      BuildNumber NVARCHAR(100) NOT NULL,
      GitCommit NVARCHAR(100) NULL,
      Branch NVARCHAR(100) NULL,
      DeploymentDate DATETIME2 NULL,
      EnvironmentId INT NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_QaBuilds_QaProjects FOREIGN KEY (ProjectId) REFERENCES QaProjects(Id),
      CONSTRAINT FK_QaBuilds_QaReleases FOREIGN KEY (ReleaseId) REFERENCES QaReleases(Id),
      CONSTRAINT FK_QaBuilds_QaEnvironments FOREIGN KEY (EnvironmentId) REFERENCES QaEnvironments(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_QaBuilds_ProjectId')
    CREATE INDEX IX_QaBuilds_ProjectId ON QaBuilds (ProjectId)
  `;
  console.log("QaBuilds ready.");

  // --- Wire Environments/Builds into Test Runs (additive, nullable — old free-text
  // Environment/DeployedBuildVersion columns are left in place, same non-destructive pattern
  // used for RunTypeId) ---
  const hasEnvironmentId = await db.query<{ Cnt: number }>`
    SELECT COUNT(*) AS Cnt FROM sys.columns WHERE object_id = OBJECT_ID('QaTestRuns') AND name = 'EnvironmentId'
  `;
  if (hasEnvironmentId.recordset[0].Cnt === 0) {
    await db.query`ALTER TABLE QaTestRuns ADD EnvironmentId INT NULL`;
    await db.query`ALTER TABLE QaTestRuns ADD CONSTRAINT FK_QaTestRuns_QaEnvironments FOREIGN KEY (EnvironmentId) REFERENCES QaEnvironments(Id)`;
    await db.query`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_QaTestRuns_EnvironmentId')
      CREATE INDEX IX_QaTestRuns_EnvironmentId ON QaTestRuns (EnvironmentId)
    `;
    console.log("Added QaTestRuns.EnvironmentId.");
  } else {
    console.log("QaTestRuns.EnvironmentId already exists — skipping.");
  }

  const hasBuildId = await db.query<{ Cnt: number }>`
    SELECT COUNT(*) AS Cnt FROM sys.columns WHERE object_id = OBJECT_ID('QaTestRuns') AND name = 'BuildId'
  `;
  if (hasBuildId.recordset[0].Cnt === 0) {
    await db.query`ALTER TABLE QaTestRuns ADD BuildId INT NULL`;
    await db.query`ALTER TABLE QaTestRuns ADD CONSTRAINT FK_QaTestRuns_QaBuilds FOREIGN KEY (BuildId) REFERENCES QaBuilds(Id)`;
    await db.query`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_QaTestRuns_BuildId')
      CREATE INDEX IX_QaTestRuns_BuildId ON QaTestRuns (BuildId)
    `;
    console.log("Added QaTestRuns.BuildId.");
  } else {
    console.log("QaTestRuns.BuildId already exists — skipping.");
  }

  console.log("QA structural-core migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
