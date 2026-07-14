import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  // StaffId NULL means "broadcast to every employee" — a device's own StaffId (or NULL,
  // meaning it matches every broadcast) determines which rows the agent companion picks up.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EmployeeNotifications' AND xtype='U')
    CREATE TABLE EmployeeNotifications (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      StaffId INT NULL,
      Message NVARCHAR(500) NOT NULL,
      SentByUserId INT NULL,
      SentByUsername NVARCHAR(100) NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_EmployeeNotifications_Staff FOREIGN KEY (StaffId) REFERENCES Staff(Id) ON DELETE CASCADE
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_EmployeeNotifications_StaffId')
    CREATE INDEX IX_EmployeeNotifications_StaffId ON EmployeeNotifications(StaffId, Id)
  `;

  // Per-device watermark — the agent companion's poll returns notifications with
  // Id > LastNotificationSeenId targeting this device's Staff (or a broadcast), then the
  // server advances the watermark so the same message never shows twice on the same device.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Devices') AND name = 'LastNotificationSeenId')
    ALTER TABLE Devices ADD LastNotificationSeenId INT NOT NULL DEFAULT 0
  `;

  console.log("Employee notifications table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
