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

  // --- Extend Devices to support server registration (additive only, workstation flow unchanged) ---
  const deviceColumns: [string, string][] = [
    ["DeviceType", "NVARCHAR(20) NOT NULL CONSTRAINT DF_Devices_DeviceType DEFAULT 'Workstation'"],
    ["DeviceName", "NVARCHAR(200) NULL"],
    ["ServerRole", "NVARCHAR(100) NULL"],
    ["StaticIpAddress", "VARCHAR(45) NULL"],
    ["LifecycleStatus", "NVARCHAR(20) NOT NULL CONSTRAINT DF_Devices_LifecycleStatus DEFAULT 'Pending'"],
  ];
  for (const [col, type] of deviceColumns) {
    await addColumnIfMissing(db, "Devices", col, type);
  }

  // --- EnrollmentTokens: optional link to a pre-registered server row ---
  await addColumnIfMissing(db, "EnrollmentTokens", "PreCreatedDeviceId", "VARCHAR(36) NULL");

  // --- DeviceHardwareInfo: motherboard/BIOS detail (serial/version already live on Devices) ---
  const hardwareColumns: [string, string][] = [
    ["MotherboardManufacturer", "NVARCHAR(150) NULL"],
    ["MotherboardModel", "NVARCHAR(150) NULL"],
    ["BiosManufacturer", "NVARCHAR(150) NULL"],
    ["BiosReleaseDate", "NVARCHAR(30) NULL"],
  ];
  for (const [col, type] of hardwareColumns) {
    await addColumnIfMissing(db, "DeviceHardwareInfo", col, type);
  }

  // --- New: multi-disk snapshot (delete-then-insert per sync, like DeviceProcessSnapshot) ---
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DeviceDisks' AND xtype='U')
    CREATE TABLE DeviceDisks (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      DiskIndex INT NOT NULL,
      Model NVARCHAR(200) NULL,
      Type VARCHAR(20) NULL,
      CapacityGB FLOAT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_DeviceDisks_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_DeviceDisks_DeviceId')
    CREATE INDEX IX_DeviceDisks_DeviceId ON DeviceDisks (DeviceId)
  `;

  // --- New: multi-interface snapshot ---
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DeviceNetworkInterfaces' AND xtype='U')
    CREATE TABLE DeviceNetworkInterfaces (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      InterfaceName NVARCHAR(100) NULL,
      MacAddress VARCHAR(20) NULL,
      IpAddresses NVARCHAR(500) NULL,
      IsUp BIT NULL,
      SpeedMbps INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_DeviceNetworkInterfaces_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_DeviceNetworkInterfaces_DeviceId')
    CREATE INDEX IX_DeviceNetworkInterfaces_DeviceId ON DeviceNetworkInterfaces (DeviceId)
  `;

  // --- New: server log shipping (Apache/PHP/MySQL/system) ---
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ServerLogEntries' AND xtype='U')
    CREATE TABLE ServerLogEntries (
      Id BIGINT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      ReceivedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      LogTimestamp DATETIME2 NULL,
      LogSource VARCHAR(30) NOT NULL,
      Severity VARCHAR(30) NULL,
      Message NVARCHAR(2000) NULL,
      RawLine NVARCHAR(MAX) NULL,
      CONSTRAINT FK_ServerLogEntries_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_ServerLogEntries_DeviceId_ReceivedAt')
    CREATE INDEX IX_ServerLogEntries_DeviceId_ReceivedAt ON ServerLogEntries (DeviceId, ReceivedAt DESC)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_ServerLogEntries_LogSource_ReceivedAt')
    CREATE INDEX IX_ServerLogEntries_LogSource_ReceivedAt ON ServerLogEntries (LogSource, ReceivedAt DESC)
  `;

  console.log("Servers schema ready (Devices/EnrollmentTokens extended, DeviceDisks/DeviceNetworkInterfaces/ServerLogEntries created).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
