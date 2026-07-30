import "dotenv/config";
import { getDb } from "../src/lib/db";

// File Integrity Monitoring: admins declare which files to watch per device (WatchedFiles);
// the agent hashes/reads each watched file on its own polling interval and reports a row here
// whenever the content changes (FileIntegrityEvents). "ModifiedBy" is best-effort - the
// currently logged-in interactive user at the moment the change was detected (agent/
// currentuser.go, already used for heartbeat's CurrentUser) - not a definitive Windows Security
// Event Log attribution (that needs SACL object-access auditing enabled per file, a much more
// invasive setup this app doesn't configure). Honest about that limitation in the UI rather
// than implying forensic-grade attribution it can't back up.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WatchedFiles' AND xtype='U')
    CREATE TABLE WatchedFiles (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      FilePath NVARCHAR(500) NOT NULL,
      Enabled BIT NOT NULL DEFAULT 1,
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_WatchedFiles_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WatchedFiles_DeviceId')
    CREATE INDEX IX_WatchedFiles_DeviceId ON WatchedFiles (DeviceId)
  `;

  // Baseline hash/content from the check just before a change was detected (NULL for the very
  // first time a newly-watched file is seen, since there's no prior state to compare against -
  // that first sighting is recorded as ChangeType='Baseline', not 'Modified').
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='FileIntegrityEvents' AND xtype='U')
    CREATE TABLE FileIntegrityEvents (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      DeviceId VARCHAR(36) NOT NULL,
      FilePath NVARCHAR(500) NOT NULL,
      ChangeType VARCHAR(20) NOT NULL,
      ModifiedBy NVARCHAR(200) NULL,
      OldHash VARCHAR(64) NULL,
      NewHash VARCHAR(64) NULL,
      OldValue NVARCHAR(MAX) NULL,
      NewValue NVARCHAR(MAX) NULL,
      DetectedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_FileIntegrityEvents_Devices FOREIGN KEY (DeviceId) REFERENCES Devices(DeviceId),
      CONSTRAINT CK_FileIntegrityEvents_ChangeType CHECK (ChangeType IN ('Baseline','Modified','Deleted','Created'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_FileIntegrityEvents_DeviceId_DetectedAt')
    CREATE INDEX IX_FileIntegrityEvents_DeviceId_DetectedAt ON FileIntegrityEvents (DeviceId, DetectedAt DESC)
  `;

  console.log("File Integrity Monitoring schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
