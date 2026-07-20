import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Linux Server Security - collected entirely by the existing Go agent (agent/linuxsecurity.go),
// same host-local-only reasoning as IIS Monitoring: SSH config, firewall rules, open ports,
// Fail2Ban jails, SELinux/AppArmor mode, file permission issues, and sudoers NOPASSWD entries
// can only be read from the Linux box itself. A device only gets a "Server Security" section
// in the UI once it reports LinuxSecurityDetected=1 - a Windows Server agent never populates
// these tables (see LinuxSecurityDetected()'s runtime.GOOS=="linux" gate).
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "Devices", "LinuxSecurityDetected", "BIT NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "Devices", "LastLinuxSecurityCheckAt", "DATETIME2 NULL");

  // Latest-snapshot-per-device scalar fields (SSH/firewall summary, SELinux/AppArmor mode,
  // permission/sudo counts) - one row per device, overwritten each pass (UPSERT), same
  // pattern as other single-row-per-device snapshot tables in this app.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LinuxSecurityStatus' AND xtype='U')
    CREATE TABLE LinuxSecurityStatus (
      DeviceId VARCHAR(36) NOT NULL PRIMARY KEY,
      SshPort INT NULL,
      SshPermitRootLogin VARCHAR(30) NULL,
      SshPasswordAuthentication VARCHAR(20) NULL,
      SshServiceActive BIT NULL,
      FirewallType VARCHAR(20) NULL,
      FirewallActive BIT NULL,
      FirewallRuleCount INT NULL,
      Fail2banInstalled BIT NULL,
      Fail2banActive BIT NULL,
      SelinuxStatus VARCHAR(20) NULL,
      ApparmorStatus VARCHAR(20) NULL,
      ApparmorEnforceCount INT NULL,
      ApparmorComplainCount INT NULL,
      WorldWritableFileCount INT NULL,
      SuidBinaryCount INT NULL,
      SudoNopasswdCount INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_LinuxSecurityStatus_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;

  // Latest-snapshot-per-listening-port (delete-then-insert per pass, same pattern as
  // IisAppPools/DeviceDisks).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LinuxOpenPorts' AND xtype='U')
    CREATE TABLE LinuxOpenPorts (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      Protocol VARCHAR(10) NOT NULL,
      Address VARCHAR(64) NOT NULL,
      Port INT NOT NULL,
      ProcessName NVARCHAR(200) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_LinuxOpenPorts_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LinuxOpenPorts_DeviceId')
    CREATE INDEX IX_LinuxOpenPorts_DeviceId ON LinuxOpenPorts (DeviceId)
  `;

  // Latest-snapshot-per-jail (delete-then-insert per pass) - only populated when fail2ban is
  // installed and active; empty otherwise.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LinuxFail2banJails' AND xtype='U')
    CREATE TABLE LinuxFail2banJails (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      JailName NVARCHAR(100) NOT NULL,
      CurrentlyBanned INT NOT NULL DEFAULT 0,
      TotalBanned INT NOT NULL DEFAULT 0,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_LinuxFail2banJails_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LinuxFail2banJails_DeviceId')
    CREATE INDEX IX_LinuxFail2banJails_DeviceId ON LinuxFail2banJails (DeviceId)
  `;

  // Sample findings for the two permission checks (world-writable files under key
  // directories, SUID binaries system-wide) - capped to the first 20 of each by the agent,
  // not the true total (that's what LinuxSecurityStatus.WorldWritableFileCount/
  // SuidBinaryCount are for) - delete-then-insert per pass.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LinuxPermissionFindings' AND xtype='U')
    CREATE TABLE LinuxPermissionFindings (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      IssueType VARCHAR(20) NOT NULL,
      Path NVARCHAR(500) NOT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_LinuxPermissionFindings_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LinuxPermissionFindings_DeviceId')
    CREATE INDEX IX_LinuxPermissionFindings_DeviceId ON LinuxPermissionFindings (DeviceId)
  `;

  // Raw NOPASSWD sudoers lines (capped to the first 30 by the agent) - delete-then-insert
  // per pass.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LinuxSudoNopasswdEntries' AND xtype='U')
    CREATE TABLE LinuxSudoNopasswdEntries (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      Entry NVARCHAR(500) NOT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_LinuxSudoNopasswdEntries_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LinuxSudoNopasswdEntries_DeviceId')
    CREATE INDEX IX_LinuxSudoNopasswdEntries_DeviceId ON LinuxSudoNopasswdEntries (DeviceId)
  `;

  console.log("Linux Server Security schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
