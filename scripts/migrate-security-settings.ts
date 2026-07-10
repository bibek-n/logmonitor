import "dotenv/config";
import { getDb } from "../src/lib/db";

// Config-only storage for Phase 1 — see the approved plan: enforcement of SSO/IP
// allowlisting/session timeout/lockout is explicitly deferred to a later phase.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SecuritySettings' AND xtype='U')
    CREATE TABLE SecuritySettings (
      Id INT NOT NULL PRIMARY KEY,
      PasswordMinLength INT NOT NULL DEFAULT 8,
      PasswordRequireUppercase BIT NOT NULL DEFAULT 1,
      PasswordRequireNumber BIT NOT NULL DEFAULT 1,
      PasswordRequireSymbol BIT NOT NULL DEFAULT 0,
      SsoEnabled BIT NOT NULL DEFAULT 0,
      SsoProvider NVARCHAR(50) NULL,
      SsoConfigJson NVARCHAR(MAX) NULL,
      IpWhitelist NVARCHAR(MAX) NULL,
      SessionTimeoutMinutes INT NULL,
      LockoutThreshold INT NULL,
      LockoutDurationMinutes INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL
    )
  `;

  const existing = await db.query`SELECT COUNT(*) AS Cnt FROM SecuritySettings WHERE Id = 1`;
  if (existing.recordset[0].Cnt === 0) {
    await db.query`INSERT INTO SecuritySettings (Id) VALUES (1)`;
    console.log("Seeded default SecuritySettings row.");
  }

  console.log("SecuritySettings table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
