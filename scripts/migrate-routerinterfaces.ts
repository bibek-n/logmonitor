import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  // 1:1 latest-state per interface (physical/logical interfaces rarely change) —
  // upserted each poll, not a growing history table.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RouterInterfaces' AND xtype='U')
    CREATE TABLE RouterInterfaces (
      Name NVARCHAR(100) NOT NULL PRIMARY KEY,
      DefaultName NVARCHAR(100) NULL,
      Type NVARCHAR(50) NULL,
      Running BIT NOT NULL DEFAULT 0,
      Disabled BIT NOT NULL DEFAULT 0,
      Slave BIT NOT NULL DEFAULT 0,
      Mtu NVARCHAR(20) NULL,
      MacAddress VARCHAR(20) NULL,
      Comment NVARCHAR(200) NULL,
      LastLinkUpTime DATETIME2 NULL,
      LastLinkDownTime DATETIME2 NULL,
      LinkDowns INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  // Active router management sessions (admin/ssh/api/winbox) — a live snapshot, not
  // history: each poll clears and re-inserts, since a session that ends shouldn't
  // linger forever the way RouterClients' unbound leases used to.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RouterActiveUsers' AND xtype='U')
    CREATE TABLE RouterActiveUsers (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL,
      Address VARCHAR(45) NULL,
      Via NVARCHAR(20) NULL,
      LoginTime DATETIME2 NULL,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  console.log("RouterInterfaces and RouterActiveUsers tables ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
