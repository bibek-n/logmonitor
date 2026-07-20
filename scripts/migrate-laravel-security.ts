import "dotenv/config";
import { getDb } from "../src/lib/db";

// Laravel Security module: a standalone security-audit module (own sidebar section, own
// Projects/Scans/Issues pages - NOT a Code Quality category) that checks a Laravel codebase
// for 9 specific risk areas: APP_DEBUG exposure, APP_KEY presence/strength, .env safety, CSRF
// protection, Mass Assignment, missing Validation, missing Sanitization/XSS risk, Storage Link
// (public disk symlink) issues, and Queue configuration problems. Mirrors CodeQualityProjects/
// Scans/ScanLog/Issues/Rules/Settings shape (see migrate-code-quality.ts) but - unlike Code
// Quality, which grew its GitHub/GitLab columns in later migrations - this module is built
// after the universal repo-connections system (see migrate-repo-connections.ts) already
// exists, so RepoConnectionId/RepoProvider/Repository*/LastSynced* live on the table from the
// start instead of needing a follow-up ALTER migration.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LaravelSecurityProjects' AND xtype='U')
    CREATE TABLE LaravelSecurityProjects (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      Description NVARCHAR(1000) NULL,
      RepositoryUrl NVARCHAR(500) NULL,
      SourcePath NVARCHAR(1000) NOT NULL,
      DefaultBranch NVARCHAR(200) NULL,
      LaravelVersion NVARCHAR(50) NULL,
      ScanConfig NVARCHAR(MAX) NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Active',
      RepoConnectionId INT NULL,
      RepoProvider VARCHAR(20) NULL,
      RepositoryOwner NVARCHAR(200) NULL,
      RepositoryName NVARCHAR(200) NULL,
      RepositoryRef NVARCHAR(200) NULL,
      LastSyncedCommitSha NVARCHAR(64) NULL,
      LastSyncedAt DATETIME2 NULL,
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      DeletedAt DATETIME2 NULL,
      CONSTRAINT FK_LaravelSecurityProjects_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id) ON DELETE SET NULL,
      CONSTRAINT FK_LaravelSecurityProjects_RepoConnection FOREIGN KEY (RepoConnectionId) REFERENCES RepoConnections(Id) ON DELETE SET NULL,
      CONSTRAINT CK_LaravelSecurityProjects_Status CHECK (Status IN ('Active', 'Inactive')),
      CONSTRAINT CK_LaravelSecurityProjects_RepoProvider CHECK (RepoProvider IS NULL OR RepoProvider IN ('GitHub', 'GitLab'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LaravelSecurityProjects_RepoConnectionId')
    CREATE INDEX IX_LaravelSecurityProjects_RepoConnectionId ON LaravelSecurityProjects (RepoConnectionId)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LaravelSecurityScans' AND xtype='U')
    CREATE TABLE LaravelSecurityScans (
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
      SecurityScore INT NULL,
      ErrorMessage NVARCHAR(2000) NULL,
      ConfigSnapshot NVARCHAR(MAX) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_LaravelSecurityScans_Project FOREIGN KEY (ProjectId) REFERENCES LaravelSecurityProjects(Id) ON DELETE CASCADE,
      CONSTRAINT FK_LaravelSecurityScans_StartedBy FOREIGN KEY (StartedByUserId) REFERENCES Users(Id) ON DELETE SET NULL,
      CONSTRAINT CK_LaravelSecurityScans_ScanType CHECK (ScanType IN ('Full', 'Incremental')),
      CONSTRAINT CK_LaravelSecurityScans_Status CHECK (Status IN ('Pending', 'Queued', 'Running', 'Completed', 'PartiallyCompleted', 'Failed', 'Cancelled'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LaravelSecurityScans_ProjectId')
    CREATE INDEX IX_LaravelSecurityScans_ProjectId ON LaravelSecurityScans (ProjectId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LaravelSecurityScans_Status')
    CREATE INDEX IX_LaravelSecurityScans_Status ON LaravelSecurityScans (Status)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LaravelSecurityScans_CreatedAt')
    CREATE INDEX IX_LaravelSecurityScans_CreatedAt ON LaravelSecurityScans (CreatedAt DESC)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LaravelSecurityScanLog' AND xtype='U')
    CREATE TABLE LaravelSecurityScanLog (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ScanId INT NOT NULL,
      Message NVARCHAR(1000) NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_LaravelSecurityScanLog_Scan FOREIGN KEY (ScanId) REFERENCES LaravelSecurityScans(Id) ON DELETE CASCADE
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LaravelSecurityScanLog_ScanId')
    CREATE INDEX IX_LaravelSecurityScanLog_ScanId ON LaravelSecurityScanLog (ScanId)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LaravelSecurityIssues' AND xtype='U')
    CREATE TABLE LaravelSecurityIssues (
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
      -- Same reasoning as CodeQualityIssues: no ON DELETE CASCADE straight from Project here,
      -- since Scans already cascades from Project and Issues cascades from Scan below - SQL
      -- Server rejects a second cascading path to the same rows. Deleting a Project still
      -- deletes its Issues transitively via Project -> Scans -> Issues.
      CONSTRAINT FK_LaravelSecurityIssues_Project FOREIGN KEY (ProjectId) REFERENCES LaravelSecurityProjects(Id),
      CONSTRAINT FK_LaravelSecurityIssues_Scan FOREIGN KEY (ScanId) REFERENCES LaravelSecurityScans(Id) ON DELETE CASCADE,
      CONSTRAINT FK_LaravelSecurityIssues_ResolvedBy FOREIGN KEY (ResolvedByUserId) REFERENCES Users(Id) ON DELETE SET NULL,
      CONSTRAINT CK_LaravelSecurityIssues_Category CHECK (Category IN ('AppDebug', 'AppKey', 'DotEnv', 'Csrf', 'MassAssignment', 'Validation', 'Sanitization', 'StorageLinks', 'Queue')),
      CONSTRAINT CK_LaravelSecurityIssues_Severity CHECK (Severity IN ('Low', 'Medium', 'High', 'Critical')),
      CONSTRAINT CK_LaravelSecurityIssues_Status CHECK (Status IN ('Open', 'Confirmed', 'Resolved', 'Ignored', 'FalsePositive')),
      CONSTRAINT CK_LaravelSecurityIssues_Confidence CHECK (ConfidenceLevel IS NULL OR ConfidenceLevel IN ('Low', 'Medium', 'High'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LaravelSecurityIssues_ProjectId')
    CREATE INDEX IX_LaravelSecurityIssues_ProjectId ON LaravelSecurityIssues (ProjectId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LaravelSecurityIssues_ScanId')
    CREATE INDEX IX_LaravelSecurityIssues_ScanId ON LaravelSecurityIssues (ScanId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LaravelSecurityIssues_Category')
    CREATE INDEX IX_LaravelSecurityIssues_Category ON LaravelSecurityIssues (Category)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LaravelSecurityIssues_Severity')
    CREATE INDEX IX_LaravelSecurityIssues_Severity ON LaravelSecurityIssues (Severity)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LaravelSecurityIssues_Status')
    CREATE INDEX IX_LaravelSecurityIssues_Status ON LaravelSecurityIssues (Status)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LaravelSecurityRules' AND xtype='U')
    CREATE TABLE LaravelSecurityRules (
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
      CONSTRAINT CK_LaravelSecurityRules_Category CHECK (Category IN ('AppDebug', 'AppKey', 'DotEnv', 'Csrf', 'MassAssignment', 'Validation', 'Sanitization', 'StorageLinks', 'Queue')),
      CONSTRAINT CK_LaravelSecurityRules_Severity CHECK (DefaultSeverity IN ('Low', 'Medium', 'High', 'Critical'))
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LaravelSecuritySettings' AND xtype='U')
    CREATE TABLE LaravelSecuritySettings (
      Id INT NOT NULL PRIMARY KEY,
      WeightAppDebug FLOAT NOT NULL DEFAULT 15,
      WeightAppKey FLOAT NOT NULL DEFAULT 15,
      WeightDotEnv FLOAT NOT NULL DEFAULT 15,
      WeightCsrf FLOAT NOT NULL DEFAULT 15,
      WeightMassAssignment FLOAT NOT NULL DEFAULT 10,
      WeightValidation FLOAT NOT NULL DEFAULT 10,
      WeightSanitization FLOAT NOT NULL DEFAULT 10,
      WeightStorageLinks FLOAT NOT NULL DEFAULT 5,
      WeightQueue FLOAT NOT NULL DEFAULT 5,
      PointsPerIssueLow FLOAT NOT NULL DEFAULT 2,
      PointsPerIssueMedium FLOAT NOT NULL DEFAULT 5,
      PointsPerIssueHigh FLOAT NOT NULL DEFAULT 10,
      PointsPerIssueCritical FLOAT NOT NULL DEFAULT 20,
      ExcludedDirectories NVARCHAR(MAX) NULL,
      -- Only '.php' - fileWalker.ts matches by path.extname(), which already covers
      -- *.blade.php (extname returns '.php' for it too) and can never match a dotfile like
      -- .env (extname of a dotfile is ''). .env/.gitignore/config files are read directly by
      -- targeted fs reads in the analyzers that need them (appDebug/appKey/dotenv/queue), not
      -- discovered via this walked-extension list. See src/lib/laravelSecurity/runScan.ts.
      AllowedExtensions NVARCHAR(500) NOT NULL DEFAULT '.php',
      MaxScanSizeMb INT NOT NULL DEFAULT 500,
      ScanTimeoutSeconds INT NOT NULL DEFAULT 1800,
      RetentionDays INT NOT NULL DEFAULT 90,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL
    )
  `;

  const existingSettings = await db.query`SELECT COUNT(*) AS Cnt FROM LaravelSecuritySettings WHERE Id = 1`;
  if (existingSettings.recordset[0].Cnt === 0) {
    await db.query`
      INSERT INTO LaravelSecuritySettings (Id, ExcludedDirectories)
      VALUES (1, '["vendor","node_modules",".git","storage/framework","storage/logs","bootstrap/cache"]')
    `;
    console.log("Seeded default LaravelSecuritySettings row.");
  } else {
    // Self-healing: an earlier run of this script (before this comment was added) seeded
    // AllowedExtensions with '.blade.php'/'.env'/'.env.example' entries that fileWalker.ts's
    // extname()-based matching can never actually match - correct them idempotently rather
    // than leaving a dead-weight value from a first deploy in place forever.
    await db.query`
      UPDATE LaravelSecuritySettings SET AllowedExtensions = '.php'
      WHERE Id = 1 AND AllowedExtensions = '.php,.blade.php,.env,.env.example'
    `;
  }

  const defaultRules: Array<{ code: string; name: string; description: string; category: string; severity: string }> = [
    { code: "appdebug.enabled-in-env", name: "APP_DEBUG may be enabled", description: "APP_DEBUG is set to true (or not explicitly false) in an environment file, which can leak stack traces, file paths, and env values on error pages.", category: "AppDebug", severity: "Critical" },
    { code: "appdebug.enabled-in-config", name: "config/app.php hardcodes debug=true", description: "The 'debug' key in config/app.php is hardcoded to true instead of reading from env('APP_DEBUG', false).", category: "AppDebug", severity: "High" },
    { code: "appkey.missing", name: "APP_KEY is missing or empty", description: "APP_KEY is not set in the environment file. Laravel cannot securely encrypt sessions, cookies, or encrypted data without it.", category: "AppKey", severity: "Critical" },
    { code: "appkey.weak-or-default", name: "APP_KEY looks weak, default, or placeholder", description: "APP_KEY does not match Laravel's base64: generated-key format, or matches a well-known placeholder/example value.", category: "AppKey", severity: "Critical" },
    { code: "dotenv.committed", name: ".env file is committed to the repository", description: "A .env file (as opposed to .env.example) is tracked in the repository, risking credential leakage.", category: "DotEnv", severity: "Critical" },
    { code: "dotenv.not-gitignored", name: ".env is not excluded by .gitignore", description: ".gitignore does not exclude .env, so a future commit could accidentally leak secrets.", category: "DotEnv", severity: "High" },
    { code: "dotenv.sensitive-default", name: ".env contains a default/example credential", description: "A credential in .env matches a common default/example value (e.g. a placeholder DB password or API key).", category: "DotEnv", severity: "Medium" },
    { code: "csrf.missing-token-in-form", name: "HTML form missing @csrf", description: "A Blade <form> using POST/PUT/PATCH/DELETE does not include @csrf or @method with a CSRF token.", category: "Csrf", severity: "High" },
    { code: "csrf.route-excluded", name: "Route excluded from CSRF verification", description: "A URI pattern is added to VerifyCsrfToken's $except array (or bypasses the 'web' middleware group), disabling CSRF protection for matching routes.", category: "Csrf", severity: "High" },
    { code: "massassignment.guarded-empty", name: "Model has $guarded = [] (mass assignment wide open)", description: "An Eloquent model sets protected $guarded = [], allowing any request field to be mass-assigned.", category: "MassAssignment", severity: "High" },
    { code: "massassignment.fillable-missing", name: "Model defines neither $fillable nor $guarded", description: "An Eloquent model has no $fillable or $guarded property, so Laravel's mass-assignment protection is undefined for it.", category: "MassAssignment", severity: "Medium" },
    { code: "massassignment.request-all", name: "Model::create()/update() called with unfiltered request()->all()", description: "A create()/update()/fill() call passes the entire request payload without validation or field filtering.", category: "MassAssignment", severity: "Medium" },
    { code: "validation.controller-missing", name: "Controller method accepts input with no validation", description: "A controller action reads request input (POST/PUT/PATCH) but never calls $request->validate(), a Form Request, or Validator::make().", category: "Validation", severity: "Medium" },
    { code: "validation.route-param-unvalidated", name: "Route model binding without existence/type constraint", description: "A route parameter is used directly in a query without a route constraint or explicit validation.", category: "Validation", severity: "Low" },
    { code: "sanitization.raw-blade-echo", name: "Unescaped Blade output ({!! !!}) of user-controlled data", description: "A Blade template uses {!! !!} (unescaped output) on a value that appears to originate from user input, risking XSS.", category: "Sanitization", severity: "High" },
    { code: "sanitization.raw-html-helper", name: "HtmlString/raw() wrapping user-controlled data", description: "new HtmlString(...) or a similar raw-HTML helper is applied to a value that appears to originate from user input.", category: "Sanitization", severity: "High" },
    { code: "storagelinks.missing-symlink", name: "storage/app/public symlink not present", description: "public/storage does not exist as a symlink, so files stored on the 'public' disk will 404 despite Storage::url() returning a path.", category: "StorageLinks", severity: "Medium" },
    { code: "storagelinks.public-disk-sensitive", name: "Sensitive-looking path stored on the public disk", description: "A Storage::disk('public') call stores a file under a path suggesting sensitive content (e.g. containing 'private', 'invoice', 'ssn').", category: "StorageLinks", severity: "Medium" },
    { code: "queue.sync-driver-in-production", name: "QUEUE_CONNECTION=sync configured", description: "The queue connection is set to 'sync', meaning queued jobs run inline on the request thread instead of asynchronously - fine for local dev, a reliability/security-adjacent issue in production (no retry/backoff, jobs run with full request context).", category: "Queue", severity: "Low" },
    { code: "queue.job-missing-failed-handling", name: "Queueable job has no failed() handler for sensitive work", description: "A Job class implementing ShouldQueue performs a sensitive action (payment, email, external API call) but defines no failed() method to handle/alert on failure.", category: "Queue", severity: "Low" },
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
        IF NOT EXISTS (SELECT * FROM LaravelSecurityRules WHERE RuleCode = @code)
        INSERT INTO LaravelSecurityRules (RuleCode, RuleName, Description, Category, DefaultSeverity, Enabled)
        VALUES (@code, @name, @description, @category, @severity, 1)
      `);
  }
  console.log(`Seeded ${defaultRules.length} default LaravelSecurityRules (idempotent).`);

  console.log("Laravel Security tables ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
