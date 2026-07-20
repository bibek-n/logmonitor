import "dotenv/config";
import { getDb } from "../src/lib/db";

// Adds authenticator-app (TOTP) login support: a QR code compatible with Google Authenticator
// and Microsoft Authenticator (both read standard otpauth:// URIs), plus one-time recovery
// codes for when the enrolled phone is unavailable. Once a user completes enrollment, this
// replaces the mandatory emailed OTP code for their future logins (see src/lib/authOptions.ts,
// src/app/api/auth/request-otp/route.ts, src/app/api/auth/verify-otp/route.ts) — it's a
// per-user switch, not a global one; users who never enroll keep using the emailed code
// exactly as before.

async function addColumnIfMissing(db: Awaited<ReturnType<typeof getDb>>, table: string, column: string, definition: string) {
  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${definition}
  `);
}

async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "Users", "TotpSecretEncrypted", "NVARCHAR(500) NULL");
  await addColumnIfMissing(db, "Users", "TotpEnabled", "BIT NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "Users", "TotpEnrolledAt", "DATETIME2 NULL");
  console.log("Users.TotpSecretEncrypted/TotpEnabled/TotpEnrolledAt ready.");

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserTotpRecoveryCodes' AND xtype='U')
    CREATE TABLE UserTotpRecoveryCodes (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      UserId INT NOT NULL,
      CodeHash NVARCHAR(255) NOT NULL,
      UsedAt DATETIME2 NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_UserTotpRecoveryCodes_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_UserTotpRecoveryCodes_UserId')
    CREATE INDEX IX_UserTotpRecoveryCodes_UserId ON UserTotpRecoveryCodes (UserId)
  `;
  console.log("UserTotpRecoveryCodes table ready.");

  console.log("TOTP migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
