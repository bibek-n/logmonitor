import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

async function main() {
  const db = await getDb();

  // Used only to build the employee's chat deep-link URL (/chat/{DeviceId}?token=...) that
  // the agent's chat companion opens in the default browser — the companion itself
  // authenticates its own unread-count poll with the device's existing ApiKeyHash via
  // agentAuth.ts, not this token.
  await addColumnIfMissing(db, "Devices", "ChatToken", "NVARCHAR(64) NULL");
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='UQ_Devices_ChatToken')
    CREATE UNIQUE INDEX UQ_Devices_ChatToken ON Devices(ChatToken) WHERE ChatToken IS NOT NULL
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ChatMessages' AND xtype='U')
    CREATE TABLE ChatMessages (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      StaffId INT NOT NULL,
      DeviceId INT NULL,
      SenderType NVARCHAR(10) NOT NULL,
      SenderName NVARCHAR(100) NOT NULL,
      Message NVARCHAR(MAX) NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      ReadByAdminAt DATETIME2 NULL,
      ReadByEmployeeAt DATETIME2 NULL,
      CONSTRAINT FK_ChatMessages_Staff FOREIGN KEY (StaffId) REFERENCES Staff(Id) ON DELETE CASCADE,
      CONSTRAINT FK_ChatMessages_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(Id) ON DELETE SET NULL,
      CONSTRAINT CK_ChatMessages_SenderType CHECK (SenderType IN ('admin', 'employee'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_ChatMessages_Staff_CreatedAt')
    CREATE INDEX IX_ChatMessages_Staff_CreatedAt ON ChatMessages(StaffId, CreatedAt)
  `;

  console.log("Chat tables ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
