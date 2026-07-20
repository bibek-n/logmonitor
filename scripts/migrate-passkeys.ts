import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserPasskeys' AND xtype='U')
    CREATE TABLE UserPasskeys (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      UserId INT NOT NULL,
      CredentialId NVARCHAR(255) NOT NULL,
      PublicKey NVARCHAR(MAX) NOT NULL,
      Counter BIGINT NOT NULL DEFAULT 0,
      Transports NVARCHAR(100) NULL,
      DeviceLabel NVARCHAR(100) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      LastUsedAt DATETIME2 NULL,
      CONSTRAINT FK_UserPasskeys_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
      CONSTRAINT UQ_UserPasskeys_CredentialId UNIQUE (CredentialId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_UserPasskeys_UserId')
    CREATE INDEX IX_UserPasskeys_UserId ON UserPasskeys(UserId)
  `;

  console.log("Passkeys (WebAuthn) table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
