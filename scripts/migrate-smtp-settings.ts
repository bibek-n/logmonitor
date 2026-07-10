import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SmtpSettings' AND xtype='U')
    CREATE TABLE SmtpSettings (
      Id INT NOT NULL PRIMARY KEY,
      Host NVARCHAR(200) NULL,
      Port INT NULL,
      Username NVARCHAR(200) NULL,
      Password NVARCHAR(500) NULL,
      Encryption VARCHAR(10) NULL,
      SenderName NVARCHAR(150) NULL,
      SenderEmail NVARCHAR(200) NULL,
      ReplyTo NVARCHAR(200) NULL,
      LastTestAt DATETIME2 NULL,
      LastTestSuccess BIT NULL,
      LastTestMessage NVARCHAR(500) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL
    )
  `;

  const existing = await db.query`SELECT COUNT(*) AS Cnt FROM SmtpSettings WHERE Id = 1`;
  if (existing.recordset[0].Cnt === 0) {
    // Seed from the existing env-var based config if present, so the new DB-backed path
    // starts in sync with whatever notifyEmail.ts was already using — see src/lib/notifyEmail.ts.
    await db
      .request()
      .input("host", sql.NVarChar, process.env.NOTIFY_SMTP_HOST ?? null)
      .input("port", sql.Int, process.env.NOTIFY_SMTP_PORT ? Number(process.env.NOTIFY_SMTP_PORT) : 587)
      .input("username", sql.NVarChar, process.env.NOTIFY_SMTP_USER ?? null)
      .input("password", sql.NVarChar, process.env.NOTIFY_SMTP_PASSWORD ?? null)
      .input("senderEmail", sql.NVarChar, process.env.NOTIFY_FROM_EMAIL ?? null)
      .query(`
        INSERT INTO SmtpSettings (Id, Host, Port, Username, Password, Encryption, SenderEmail)
        VALUES (1, @host, @port, @username, @password, 'TLS', @senderEmail)
      `);
    console.log("Seeded SmtpSettings row (from NOTIFY_SMTP_* env vars if present, else blank).");
  }

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EmailDeliveryLog' AND xtype='U')
    CREATE TABLE EmailDeliveryLog (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ToAddress NVARCHAR(200) NOT NULL,
      Subject NVARCHAR(300) NULL,
      Success BIT NOT NULL,
      ErrorMessage NVARCHAR(1000) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_EmailDeliveryLog_CreatedAt')
    CREATE INDEX IX_EmailDeliveryLog_CreatedAt ON EmailDeliveryLog (CreatedAt DESC)
  `;

  console.log("SmtpSettings and EmailDeliveryLog tables ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
