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

  // --- Extend Devices with identity fields collected at enrollment ---
  const deviceColumns: [string, string][] = [
    ["DeviceUUID", "VARCHAR(64) NULL"],
    ["MachineId", "VARCHAR(64) NULL"],
    ["Manufacturer", "NVARCHAR(200) NULL"],
    ["Model", "NVARCHAR(200) NULL"],
    ["SerialNumber", "NVARCHAR(200) NULL"],
    ["AssetTag", "NVARCHAR(100) NULL"],
    ["BiosVersion", "NVARCHAR(200) NULL"],
    ["MotherboardSerial", "NVARCHAR(200) NULL"],
    ["Domain", "NVARCHAR(200) NULL"],
    ["Workgroup", "NVARCHAR(200) NULL"],
    ["Timezone", "NVARCHAR(100) NULL"],
    ["Country", "NVARCHAR(100) NULL"],
    ["CurrentUser", "NVARCHAR(200) NULL"],
  ];
  for (const [col, type] of deviceColumns) {
    await addColumnIfMissing(db, "Devices", col, type);
  }

  // --- Extend DeviceMetrics with the richer per-poll signals ---
  const metricColumns: [string, string][] = [
    ["SwapPct", "FLOAT NULL"],
    ["DiskReadMBps", "FLOAT NULL"],
    ["DiskWriteMBps", "FLOAT NULL"],
    ["DiskIops", "FLOAT NULL"],
    ["ProcessCount", "INT NULL"],
    ["ThreadCount", "INT NULL"],
    ["HandleCount", "INT NULL"],
    ["LoadAvg1", "FLOAT NULL"],
    ["LoadAvg5", "FLOAT NULL"],
    ["LoadAvg15", "FLOAT NULL"],
    ["GpuUsagePct", "FLOAT NULL"],
    ["BatteryPct", "FLOAT NULL"],
    ["BatteryHealth", "NVARCHAR(50) NULL"],
    ["BatteryCycleCount", "INT NULL"],
    ["PowerAdapterConnected", "BIT NULL"],
    ["CpuTempC", "FLOAT NULL"],
  ];
  for (const [col, type] of metricColumns) {
    await addColumnIfMissing(db, "DeviceMetrics", col, type);
  }

  // Interval screenshots are now compressed to JPEG (manual captures stay PNG for
  // fidelity), so the file-serving route needs to know which to set Content-Type to.
  await addColumnIfMissing(db, "Screenshots", "Format", "VARCHAR(4) NOT NULL CONSTRAINT DF_Screenshots_Format DEFAULT 'png'");

  // --- New 1:1 latest-state tables ---
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DeviceHardwareInfo' AND xtype='U')
    CREATE TABLE DeviceHardwareInfo (
      DeviceId VARCHAR(36) NOT NULL PRIMARY KEY,
      CpuModel NVARCHAR(200) NULL,
      CpuManufacturer NVARCHAR(100) NULL,
      CpuCores INT NULL,
      CpuThreads INT NULL,
      CpuClockMhz FLOAT NULL,
      MemoryTotalMB BIGINT NULL,
      DiskModel NVARCHAR(200) NULL,
      DiskType VARCHAR(10) NULL,
      DiskCapacityGB FLOAT NULL,
      GpuName NVARCHAR(200) NULL,
      OsEdition NVARCHAR(100) NULL,
      OsBuild NVARCHAR(100) NULL,
      KernelVersion NVARCHAR(100) NULL,
      Architecture VARCHAR(20) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_DeviceHardwareInfo_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DeviceSecurityStatus' AND xtype='U')
    CREATE TABLE DeviceSecurityStatus (
      DeviceId VARCHAR(36) NOT NULL PRIMARY KEY,
      AntivirusStatus NVARCHAR(50) NULL,
      DefenderStatus NVARCHAR(50) NULL,
      FirewallEnabled BIT NULL,
      FirewallRulesCount INT NULL,
      BitLockerStatus NVARCHAR(50) NULL,
      LuksStatus NVARCHAR(50) NULL,
      SecureBootEnabled BIT NULL,
      TpmVersion NVARCHAR(20) NULL,
      SELinuxStatus NVARCHAR(50) NULL,
      AppArmorStatus NVARCHAR(50) NULL,
      LastScanAt DATETIME2 NULL,
      FailedLoginCount24h INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_DeviceSecurityStatus_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DeviceNetworkInfo' AND xtype='U')
    CREATE TABLE DeviceNetworkInfo (
      DeviceId VARCHAR(36) NOT NULL PRIMARY KEY,
      CurrentIp VARCHAR(45) NULL,
      PublicIp VARCHAR(45) NULL,
      GatewayIp VARCHAR(45) NULL,
      DnsServers NVARCHAR(500) NULL,
      WifiSsid NVARCHAR(200) NULL,
      VpnActive BIT NULL,
      EthernetConnected BIT NULL,
      OpenPortsJson NVARCHAR(MAX) NULL,
      ListeningPortsJson NVARCHAR(MAX) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_DeviceNetworkInfo_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DeviceProcessSnapshot' AND xtype='U')
    CREATE TABLE DeviceProcessSnapshot (
      DeviceId VARCHAR(36) NOT NULL PRIMARY KEY,
      ProcessesJson NVARCHAR(MAX) NOT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_DeviceProcessSnapshot_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DeviceServiceSnapshot' AND xtype='U')
    CREATE TABLE DeviceServiceSnapshot (
      DeviceId VARCHAR(36) NOT NULL PRIMARY KEY,
      ServicesJson NVARCHAR(MAX) NOT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_DeviceServiceSnapshot_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DeviceSoftwareSnapshot' AND xtype='U')
    CREATE TABLE DeviceSoftwareSnapshot (
      DeviceId VARCHAR(36) NOT NULL PRIMARY KEY,
      SoftwareJson NVARCHAR(MAX) NOT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_DeviceSoftwareSnapshot_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;

  // --- Append-only history tables ---
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DeviceUsbEvents' AND xtype='U')
    CREATE TABLE DeviceUsbEvents (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      EventType VARCHAR(10) NOT NULL,
      DeviceName NVARCHAR(200) NULL,
      VendorId VARCHAR(20) NULL,
      SerialNumber NVARCHAR(100) NULL,
      StorageCapacityGB FLOAT NULL,
      DetectedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_DeviceUsbEvents_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_DeviceUsbEvents_DeviceId_DetectedAt')
    CREATE INDEX IX_DeviceUsbEvents_DeviceId_DetectedAt ON DeviceUsbEvents (DeviceId, DetectedAt DESC)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DeviceAlerts' AND xtype='U')
    CREATE TABLE DeviceAlerts (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      AlertType VARCHAR(50) NOT NULL,
      Severity VARCHAR(20) NOT NULL,
      Message NVARCHAR(500) NOT NULL,
      TriggeredAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      ResolvedAt DATETIME2 NULL,
      AcknowledgedByUserId INT NULL,
      AcknowledgedAt DATETIME2 NULL,
      CONSTRAINT FK_DeviceAlerts_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_DeviceAlerts_DeviceId_TriggeredAt')
    CREATE INDEX IX_DeviceAlerts_DeviceId_TriggeredAt ON DeviceAlerts (DeviceId, TriggeredAt DESC)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_DeviceAlerts_Unresolved')
    CREATE INDEX IX_DeviceAlerts_Unresolved ON DeviceAlerts (DeviceId, AlertType) WHERE ResolvedAt IS NULL
  `;

  console.log("Phase 2 endpoint agent schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
