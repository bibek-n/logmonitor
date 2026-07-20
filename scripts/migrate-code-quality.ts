import "dotenv/config";
import { getDb } from "../src/lib/db";

// Code Quality module: static-analysis projects, scans, per-scan progress log, issues,
// raw per-scan metrics, configurable rules, and a singleton settings row (thresholds/
// weights/exclusions) — same "no hard-coded configurable values" reasoning as
// CompanySettings. Scans are fire-and-forget (see runScan.ts), mirroring
// websiteSecurityAudit/runScan.ts's createScanRow()+executeScan() split; CodeQualityScanLog
// plays the same role as WebsiteAuditScanLog (progress messages the UI polls).
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CodeQualityProjects' AND xtype='U')
    CREATE TABLE CodeQualityProjects (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      Description NVARCHAR(1000) NULL,
      RepositoryUrl NVARCHAR(500) NULL,
      SourcePath NVARCHAR(1000) NOT NULL,
      DefaultBranch NVARCHAR(200) NULL,
      Language NVARCHAR(50) NULL,
      ScanConfig NVARCHAR(MAX) NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Active',
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      DeletedAt DATETIME2 NULL,
      CONSTRAINT FK_CodeQualityProjects_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id) ON DELETE SET NULL,
      CONSTRAINT CK_CodeQualityProjects_Status CHECK (Status IN ('Active', 'Inactive'))
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CodeQualityScans' AND xtype='U')
    CREATE TABLE CodeQualityScans (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ProjectId INT NOT NULL,
      Branch NVARCHAR(200) NULL,
      ScanType VARCHAR(20) NOT NULL DEFAULT 'Full',
      Status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      StartedByUserId INT NULL,
      StartedAt DATETIME2 NULL,
      CompletedAt DATETIME2 NULL,
      DurationMs INT NULL,
      FilesScanned INT NOT NULL DEFAULT 0,
      LinesOfCode INT NOT NULL DEFAULT 0,
      QualityScore INT NULL,
      ErrorMessage NVARCHAR(2000) NULL,
      ConfigSnapshot NVARCHAR(MAX) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_CodeQualityScans_Project FOREIGN KEY (ProjectId) REFERENCES CodeQualityProjects(Id) ON DELETE CASCADE,
      CONSTRAINT FK_CodeQualityScans_StartedBy FOREIGN KEY (StartedByUserId) REFERENCES Users(Id) ON DELETE SET NULL,
      CONSTRAINT CK_CodeQualityScans_ScanType CHECK (ScanType IN ('Full', 'Incremental')),
      CONSTRAINT CK_CodeQualityScans_Status CHECK (Status IN ('Pending', 'Queued', 'Running', 'Completed', 'PartiallyCompleted', 'Failed', 'Cancelled'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CodeQualityScans_ProjectId')
    CREATE INDEX IX_CodeQualityScans_ProjectId ON CodeQualityScans (ProjectId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CodeQualityScans_Status')
    CREATE INDEX IX_CodeQualityScans_Status ON CodeQualityScans (Status)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CodeQualityScans_CreatedAt')
    CREATE INDEX IX_CodeQualityScans_CreatedAt ON CodeQualityScans (CreatedAt DESC)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CodeQualityScanLog' AND xtype='U')
    CREATE TABLE CodeQualityScanLog (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScanId INT NOT NULL,
      Message NVARCHAR(1000) NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_CodeQualityScanLog_Scan FOREIGN KEY (ScanId) REFERENCES CodeQualityScans(Id) ON DELETE CASCADE
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CodeQualityScanLog_ScanId')
    CREATE INDEX IX_CodeQualityScanLog_ScanId ON CodeQualityScanLog (ScanId)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CodeQualityIssues' AND xtype='U')
    CREATE TABLE CodeQualityIssues (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      IssueNumber NVARCHAR(20) NULL,
      ProjectId INT NOT NULL,
      ScanId INT NOT NULL,
      Category VARCHAR(30) NOT NULL,
      RuleCode NVARCHAR(100) NULL,
      Title NVARCHAR(300) NOT NULL,
      Description NVARCHAR(2000) NULL,
      FilePath NVARCHAR(1000) NOT NULL,
      StartLine INT NULL,
      EndLine INT NULL,
      CodeElement NVARCHAR(300) NULL,
      Severity VARCHAR(20) NOT NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Open',
      ConfidenceLevel VARCHAR(20) NULL,
      Recommendation NVARCHAR(2000) NULL,
      CodeSnippet NVARCHAR(MAX) NULL,
      ResolutionNote NVARCHAR(2000) NULL,
      ResolvedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      -- No ON DELETE CASCADE here: CodeQualityScans already cascades from Project, and
      -- Issues cascades from Scan below - a second cascading path straight from Project
      -- would give SQL Server two routes to the same rows, which it rejects outright
      -- ("may cause cycles or multiple cascade paths"). Deleting a Project still deletes
      -- its Issues transitively via Project -> Scans -> Issues.
      CONSTRAINT FK_CodeQualityIssues_Project FOREIGN KEY (ProjectId) REFERENCES CodeQualityProjects(Id),
      CONSTRAINT FK_CodeQualityIssues_Scan FOREIGN KEY (ScanId) REFERENCES CodeQualityScans(Id) ON DELETE CASCADE,
      CONSTRAINT FK_CodeQualityIssues_ResolvedBy FOREIGN KEY (ResolvedByUserId) REFERENCES Users(Id) ON DELETE SET NULL,
      CONSTRAINT CK_CodeQualityIssues_Category CHECK (Category IN ('Complexity', 'Duplication', 'DeadCode', 'UnusedVariable', 'UnusedFunction', 'CodingStandard')),
      CONSTRAINT CK_CodeQualityIssues_Severity CHECK (Severity IN ('Low', 'Medium', 'High', 'Critical')),
      CONSTRAINT CK_CodeQualityIssues_Status CHECK (Status IN ('Open', 'Confirmed', 'Resolved', 'Ignored', 'FalsePositive')),
      CONSTRAINT CK_CodeQualityIssues_Confidence CHECK (ConfidenceLevel IS NULL OR ConfidenceLevel IN ('Low', 'Medium', 'High'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CodeQualityIssues_ProjectId')
    CREATE INDEX IX_CodeQualityIssues_ProjectId ON CodeQualityIssues (ProjectId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CodeQualityIssues_ScanId')
    CREATE INDEX IX_CodeQualityIssues_ScanId ON CodeQualityIssues (ScanId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CodeQualityIssues_Category')
    CREATE INDEX IX_CodeQualityIssues_Category ON CodeQualityIssues (Category)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CodeQualityIssues_Severity')
    CREATE INDEX IX_CodeQualityIssues_Severity ON CodeQualityIssues (Severity)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CodeQualityIssues_Status')
    CREATE INDEX IX_CodeQualityIssues_Status ON CodeQualityIssues (Status)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CodeQualityMetrics' AND xtype='U')
    CREATE TABLE CodeQualityMetrics (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScanId INT NOT NULL,
      MetricType VARCHAR(30) NOT NULL,
      MetricName NVARCHAR(200) NOT NULL,
      Value FLOAT NOT NULL,
      Threshold FLOAT NULL,
      AdditionalData NVARCHAR(MAX) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_CodeQualityMetrics_Scan FOREIGN KEY (ScanId) REFERENCES CodeQualityScans(Id) ON DELETE CASCADE
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CodeQualityMetrics_ScanId')
    CREATE INDEX IX_CodeQualityMetrics_ScanId ON CodeQualityMetrics (ScanId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CodeQualityMetrics_ScanId_MetricType')
    CREATE INDEX IX_CodeQualityMetrics_ScanId_MetricType ON CodeQualityMetrics (ScanId, MetricType)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CodeQualityRules' AND xtype='U')
    CREATE TABLE CodeQualityRules (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      RuleCode NVARCHAR(100) NOT NULL UNIQUE,
      RuleName NVARCHAR(200) NOT NULL,
      Description NVARCHAR(1000) NULL,
      Category VARCHAR(30) NOT NULL,
      DefaultSeverity VARCHAR(20) NOT NULL,
      Enabled BIT NOT NULL DEFAULT 1,
      Configuration NVARCHAR(MAX) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_CodeQualityRules_Category CHECK (Category IN ('Complexity', 'Duplication', 'DeadCode', 'UnusedVariable', 'UnusedFunction', 'CodingStandard')),
      CONSTRAINT CK_CodeQualityRules_Severity CHECK (DefaultSeverity IN ('Low', 'Medium', 'High', 'Critical'))
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CodeQualitySettings' AND xtype='U')
    CREATE TABLE CodeQualitySettings (
      Id INT NOT NULL PRIMARY KEY,
      ComplexityLowMax INT NOT NULL DEFAULT 5,
      ComplexityMediumMax INT NOT NULL DEFAULT 10,
      ComplexityHighMax INT NOT NULL DEFAULT 20,
      DuplicationThresholdPercent FLOAT NOT NULL DEFAULT 5,
      MinDuplicateBlockSize INT NOT NULL DEFAULT 6,
      WeightComplexity FLOAT NOT NULL DEFAULT 25,
      WeightDuplication FLOAT NOT NULL DEFAULT 20,
      WeightDeadCode FLOAT NOT NULL DEFAULT 15,
      WeightUnusedVariables FLOAT NOT NULL DEFAULT 10,
      WeightUnusedFunctions FLOAT NOT NULL DEFAULT 10,
      WeightCodingStandards FLOAT NOT NULL DEFAULT 20,
      ScaleComplexity FLOAT NOT NULL DEFAULT 10,
      ScaleDuplication FLOAT NOT NULL DEFAULT 2,
      ScaleDeadCode FLOAT NOT NULL DEFAULT 8,
      ScaleUnusedVariables FLOAT NOT NULL DEFAULT 6,
      ScaleUnusedFunctions FLOAT NOT NULL DEFAULT 6,
      ScaleCodingStandards FLOAT NOT NULL DEFAULT 5,
      ExcludedDirectories NVARCHAR(MAX) NULL,
      AllowedExtensions NVARCHAR(500) NOT NULL DEFAULT '.ts,.tsx,.js,.jsx',
      MaxScanSizeMb INT NOT NULL DEFAULT 500,
      ScanTimeoutSeconds INT NOT NULL DEFAULT 1800,
      RetentionDays INT NOT NULL DEFAULT 90,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CodeQualitySettings') AND name = 'MaxLineLength')
    ALTER TABLE CodeQualitySettings ADD MaxLineLength INT NOT NULL DEFAULT 120
  `;

  const existingSettings = await db.query`SELECT COUNT(*) AS Cnt FROM CodeQualitySettings WHERE Id = 1`;
  if (existingSettings.recordset[0].Cnt === 0) {
    await db.query`
      INSERT INTO CodeQualitySettings (Id, ExcludedDirectories)
      VALUES (1, '["node_modules",".next","dist","build",".git",".turbo","coverage"]')
    `;
    console.log("Seeded default CodeQualitySettings row.");
  }

  const defaultRules: Array<{ code: string; name: string; description: string; category: string; severity: string }> = [
    { code: "complexity.function-threshold", name: "Function exceeds complexity threshold", description: "A function or method's cyclomatic complexity exceeds the configured threshold.", category: "Complexity", severity: "Medium" },
    { code: "duplication.block", name: "Duplicated code block", description: "A block of code is duplicated elsewhere in the project above the minimum block size.", category: "Duplication", severity: "Medium" },
    { code: "deadcode.unreachable", name: "Unreachable code", description: "Code appears after a return, throw, break, or continue statement and can never execute.", category: "DeadCode", severity: "Medium" },
    { code: "deadcode.unused-export", name: "Unused export", description: "An exported declaration is never imported anywhere else in the project.", category: "DeadCode", severity: "Low" },
    { code: "unused.variable", name: "Unused variable", description: "A declared variable is never read.", category: "UnusedVariable", severity: "Low" },
    { code: "unused.function", name: "Unused function", description: "A declared function is never referenced.", category: "UnusedFunction", severity: "Low" },
    { code: "style.no-var", name: "Use of var", description: "'var' is used instead of 'let' or 'const'.", category: "CodingStandard", severity: "Low" },
    { code: "style.no-console", name: "Console statement", description: "A console.* call was left in the code.", category: "CodingStandard", severity: "Low" },
    { code: "style.max-line-length", name: "Line too long", description: "A line exceeds the configured maximum length.", category: "CodingStandard", severity: "Low" },
    { code: "style.empty-block", name: "Empty block", description: "An empty block statement (e.g. empty if/catch) was found.", category: "CodingStandard", severity: "Low" },
    { code: "style.prefer-const", name: "Prefer const", description: "A variable declared with 'let' is never reassigned.", category: "CodingStandard", severity: "Low" },
    { code: "style.naming-convention", name: "Naming convention violation", description: "An identifier does not follow the expected naming convention (camelCase for variables/functions, PascalCase for types/classes).", category: "CodingStandard", severity: "Low" },
  ];
  for (const rule of defaultRules) {
    await db
      .request()
      .input("code", rule.code)
      .input("name", rule.name)
      .input("description", rule.description)
      .input("category", rule.category)
      .input("severity", rule.severity)
      .query(`
        IF NOT EXISTS (SELECT * FROM CodeQualityRules WHERE RuleCode = @code)
        INSERT INTO CodeQualityRules (RuleCode, RuleName, Description, Category, DefaultSeverity, Enabled)
        VALUES (@code, @name, @description, @category, @severity, 1)
      `);
  }
  console.log(`Seeded ${defaultRules.length} default CodeQualityRules (idempotent).`);

  console.log("Code Quality tables ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
