import "dotenv/config";
import { getDb } from "../src/lib/db";

// GitHub repository connections for the Code Quality module. A connection stores an
// encrypted credential (never plaintext, see src/lib/codeQuality/github/crypto.ts) for one of
// three auth methods (PAT / OAuthApp / GitHubApp) and is referenced by zero or more
// CodeQualityProjects rows via GitHubConnectionId. Separate migration script from
// migrate-code-quality.ts, following this app's convention of one script per schema change
// rather than editing an already-shipped migration.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CodeQualityGitHubConnections' AND xtype='U')
    CREATE TABLE CodeQualityGitHubConnections (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      AuthMethod VARCHAR(20) NOT NULL,
      OwnerLogin NVARCHAR(200) NULL,
      AccessTokenEncrypted NVARCHAR(MAX) NULL,
      RefreshTokenEncrypted NVARCHAR(MAX) NULL,
      TokenExpiresAt DATETIME2 NULL,
      InstallationId BIGINT NULL,
      ScopesGranted NVARCHAR(500) NULL,
      CreatedByUserId INT NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      DeletedAt DATETIME2 NULL,
      CONSTRAINT FK_CodeQualityGitHubConnections_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id),
      CONSTRAINT CK_CodeQualityGitHubConnections_AuthMethod CHECK (AuthMethod IN ('PAT', 'OAuthApp', 'GitHubApp'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CodeQualityGitHubConnections_DeletedAt')
    CREATE INDEX IX_CodeQualityGitHubConnections_DeletedAt ON CodeQualityGitHubConnections (DeletedAt)
  `;

  // Idempotent column additions to the already-shipped CodeQualityProjects table - same
  // IF NOT EXISTS-on-sys.columns pattern migrate-code-quality.ts itself used for MaxLineLength.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CodeQualityProjects') AND name = 'GitHubConnectionId')
    ALTER TABLE CodeQualityProjects ADD GitHubConnectionId INT NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CodeQualityProjects') AND name = 'RepositoryOwner')
    ALTER TABLE CodeQualityProjects ADD RepositoryOwner NVARCHAR(200) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CodeQualityProjects') AND name = 'RepositoryName')
    ALTER TABLE CodeQualityProjects ADD RepositoryName NVARCHAR(200) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CodeQualityProjects') AND name = 'RepositoryRef')
    ALTER TABLE CodeQualityProjects ADD RepositoryRef NVARCHAR(200) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CodeQualityProjects') AND name = 'LastSyncedCommitSha')
    ALTER TABLE CodeQualityProjects ADD LastSyncedCommitSha NVARCHAR(64) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CodeQualityProjects') AND name = 'LastSyncedAt')
    ALTER TABLE CodeQualityProjects ADD LastSyncedAt DATETIME2 NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_CodeQualityProjects_GitHubConnection')
    ALTER TABLE CodeQualityProjects
      ADD CONSTRAINT FK_CodeQualityProjects_GitHubConnection FOREIGN KEY (GitHubConnectionId)
      REFERENCES CodeQualityGitHubConnections(Id) ON DELETE SET NULL
  `;

  console.log("Code Quality GitHub connections migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
