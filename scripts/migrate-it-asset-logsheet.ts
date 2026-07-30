import "dotenv/config";
import { getDb } from "../src/lib/db";

// IT Asset Logsheet: a standalone operational ledger for servers, desktops, laptops, VMs and
// network devices - password rotation, patch/update history, software inventory, and general
// maintenance activity. Deliberately NOT built on top of the existing Devices table (Go-agent
// enrolled endpoints only) or Staff (network-observed employees) - this register also needs to
// cover firewalls/routers/switches/printers and manually-entered assets that never run the
// agent, and it needs fields (purchase date, warranty, criticality, password rotation) that
// don't belong on either of those tables. LinkedDeviceId/LinkedStaffId are optional convenience
// FKs for the subset of assets that *do* correspond to an agent-enrolled device or a known staff
// member, matching the light-touch cross-linking style used elsewhere (e.g. RemoteConnections
// doesn't hard-depend on Devices either).
//
// Reuses the app's existing generic Users/Roles/RolePermissions permission system and
// AdminAuditLog table rather than creating parallel users/roles/permissions/audit_logs tables -
// every other module in this app follows that same convention (see requireSecurityCenterPermission.ts
// et al.), so a fresh set here would just be inconsistent duplication.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Assets' AND xtype='U')
    CREATE TABLE Assets (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      AssetTag NVARCHAR(100) NOT NULL,
      Hostname NVARCHAR(255) NULL,
      DeviceName NVARCHAR(255) NULL,
      AssetType VARCHAR(30) NOT NULL,
      DeviceCategory NVARCHAR(100) NULL,
      Manufacturer NVARCHAR(200) NULL,
      Model NVARCHAR(200) NULL,
      SerialNumber NVARCHAR(200) NULL,
      OperatingSystem NVARCHAR(200) NULL,
      OsVersion NVARCHAR(100) NULL,
      IpAddress VARCHAR(45) NULL,
      MacAddress VARCHAR(20) NULL,
      DomainOrWorkgroup NVARCHAR(200) NULL,
      IsVirtual BIT NOT NULL DEFAULT 0,
      Department NVARCHAR(200) NULL,
      Location NVARCHAR(200) NULL,
      AssignedUser NVARCHAR(200) NULL,
      AssetOwner NVARCHAR(200) NULL,
      ResponsibleTechnician NVARCHAR(200) NULL,
      PurchaseDate DATE NULL,
      WarrantyExpiryDate DATE NULL,
      InstallationDate DATE NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Active',
      Criticality VARCHAR(10) NOT NULL DEFAULT 'Medium',
      Environment NVARCHAR(50) NULL,
      LastInventoryCheckDate DATE NULL,
      NextInventoryCheckDate DATE NULL,
      Notes NVARCHAR(MAX) NULL,
      LinkedDeviceId INT NULL REFERENCES Devices(Id),
      LinkedStaffId INT NULL REFERENCES Staff(Id),
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      CreatedByUsername NVARCHAR(100) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      UpdatedByUsername NVARCHAR(100) NULL,
      IsDeleted BIT NOT NULL DEFAULT 0,
      DeletedAt DATETIME2 NULL,
      DeletedByUserId INT NULL,
      CONSTRAINT UQ_Assets_AssetTag UNIQUE (AssetTag),
      CONSTRAINT CK_Assets_AssetType CHECK (AssetType IN ('Server','Desktop','Laptop','VirtualMachine','Firewall','Router','Switch','StorageDevice','Printer','Other')),
      CONSTRAINT CK_Assets_Status CHECK (Status IN ('Active','Inactive','UnderMaintenance','Retired','Disposed','Lost','Spare')),
      CONSTRAINT CK_Assets_Criticality CHECK (Criticality IN ('Critical','High','Medium','Low'))
    )
  `;
  for (const [name, col] of [
    ["IX_Assets_Hostname", "Hostname"],
    ["IX_Assets_SerialNumber", "SerialNumber"],
    ["IX_Assets_IpAddress", "IpAddress"],
    ["IX_Assets_Status", "Status"],
    ["IX_Assets_AssignedUser", "AssignedUser"],
    ["IX_Assets_Department", "Department"],
  ] as const) {
    await db.query(
      `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='${name}') CREATE INDEX ${name} ON Assets (${col}) WHERE IsDeleted = 0`
    );
  }

  // NextPasswordChangeDate/Status are plain stored columns written by the application
  // (repository.ts computes them on every insert/update) rather than SQL computed columns -
  // GETDATE()-dependent expressions can't be PERSISTED/indexed in SQL Server, and every other
  // "status drifts with the calendar" field in this app (e.g. Remote Access credential rotation)
  // uses the same stored-value-plus-daily-refresh-job approach for the same reason.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PasswordChangeLogs' AND xtype='U')
    CREATE TABLE PasswordChangeLogs (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      AssetId INT NOT NULL REFERENCES Assets(Id) ON DELETE CASCADE,
      AccountOrServiceName NVARCHAR(200) NOT NULL,
      AccountType VARCHAR(30) NOT NULL,
      UsernameOrAccountId NVARCHAR(200) NULL,
      CredentialLocationRef NVARCHAR(500) NULL,
      LastPasswordChangeDate DATE NULL,
      RotationIntervalDays INT NULL,
      NextPasswordChangeDate DATE NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'NotConfigured',
      ChangedBy NVARCHAR(200) NULL,
      ApprovedBy NVARCHAR(200) NULL,
      VerificationStatus VARCHAR(20) NULL,
      VerificationDate DATE NULL,
      ReasonForChange NVARCHAR(500) NULL,
      ChangeRequestNumber NVARCHAR(100) NULL,
      Notes NVARCHAR(MAX) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      CreatedByUsername NVARCHAR(100) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      UpdatedByUsername NVARCHAR(100) NULL,
      IsDeleted BIT NOT NULL DEFAULT 0,
      DeletedAt DATETIME2 NULL,
      DeletedByUserId INT NULL,
      CONSTRAINT CK_PasswordChangeLogs_AccountType CHECK (AccountType IN ('LocalAdministrator','DomainAdministrator','ServiceAccount','DatabaseAccount','ApplicationAccount','NetworkDeviceAccount','BackupAccount','EmailAccount','Other')),
      CONSTRAINT CK_PasswordChangeLogs_Status CHECK (Status IN ('Current','DueSoon','DueToday','Overdue','NotConfigured')),
      CONSTRAINT CK_PasswordChangeLogs_VerificationStatus CHECK (VerificationStatus IN ('Pending','Verified','Failed') OR VerificationStatus IS NULL)
    )
  `;
  for (const [name, col] of [
    ["IX_PasswordChangeLogs_AssetId", "AssetId"],
    ["IX_PasswordChangeLogs_NextPasswordChangeDate", "NextPasswordChangeDate"],
    ["IX_PasswordChangeLogs_Status", "Status"],
  ] as const) {
    await db.query(
      `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='${name}') CREATE INDEX ${name} ON PasswordChangeLogs (${col}) WHERE IsDeleted = 0`
    );
  }

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PatchUpdateLogs' AND xtype='U')
    CREATE TABLE PatchUpdateLogs (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      AssetId INT NOT NULL REFERENCES Assets(Id) ON DELETE CASCADE,
      UpdateType VARCHAR(30) NOT NULL,
      Vendor NVARCHAR(200) NULL,
      Product NVARCHAR(200) NULL,
      PatchName NVARCHAR(300) NOT NULL,
      KbOrPatchReference NVARCHAR(100) NULL,
      Version NVARCHAR(100) NULL,
      Severity VARCHAR(20) NOT NULL DEFAULT 'Medium',
      ReleaseDate DATE NULL,
      ScheduledInstallationDate DATE NULL,
      ActualInstallationDate DATE NULL,
      InstallationStatus VARCHAR(20) NOT NULL DEFAULT 'Planned',
      RebootRequired BIT NOT NULL DEFAULT 0,
      RebootCompleted BIT NOT NULL DEFAULT 0,
      ValidationStatus VARCHAR(20) NOT NULL DEFAULT 'Pending',
      ValidationDate DATE NULL,
      InstalledBy NVARCHAR(200) NULL,
      ApprovedBy NVARCHAR(200) NULL,
      ChangeRequestNumber NVARCHAR(100) NULL,
      FailureReason NVARCHAR(1000) NULL,
      RollbackPerformed BIT NOT NULL DEFAULT 0,
      RollbackDetails NVARCHAR(1000) NULL,
      Notes NVARCHAR(MAX) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      CreatedByUsername NVARCHAR(100) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      UpdatedByUsername NVARCHAR(100) NULL,
      IsDeleted BIT NOT NULL DEFAULT 0,
      DeletedAt DATETIME2 NULL,
      DeletedByUserId INT NULL,
      CONSTRAINT CK_PatchUpdateLogs_UpdateType CHECK (UpdateType IN ('OperatingSystemUpdate','SecurityPatch','FirmwareUpdate','DriverUpdate','ApplicationUpdate','AntivirusDefinition','Hotfix','EmergencyPatch','Other')),
      CONSTRAINT CK_PatchUpdateLogs_Severity CHECK (Severity IN ('Critical','High','Medium','Low','Informational')),
      CONSTRAINT CK_PatchUpdateLogs_InstallationStatus CHECK (InstallationStatus IN ('Planned','Scheduled','InProgress','Installed','Failed','RolledBack','Deferred','NotApplicable')),
      CONSTRAINT CK_PatchUpdateLogs_ValidationStatus CHECK (ValidationStatus IN ('Pending','Successful','Failed','NotRequired')),
      CONSTRAINT CK_PatchUpdateLogs_FailureReasonRequired CHECK (InstallationStatus <> 'Failed' OR FailureReason IS NOT NULL),
      CONSTRAINT CK_PatchUpdateLogs_RollbackDetailsRequired CHECK (RollbackPerformed = 0 OR RollbackDetails IS NOT NULL),
      CONSTRAINT CK_PatchUpdateLogs_DateOrder CHECK (ActualInstallationDate IS NULL OR ScheduledInstallationDate IS NULL OR ActualInstallationDate >= ScheduledInstallationDate)
    )
  `;
  for (const [name, col] of [
    ["IX_PatchUpdateLogs_AssetId", "AssetId"],
    ["IX_PatchUpdateLogs_Severity", "Severity"],
    ["IX_PatchUpdateLogs_InstallationStatus", "InstallationStatus"],
    ["IX_PatchUpdateLogs_ScheduledInstallationDate", "ScheduledInstallationDate"],
  ] as const) {
    await db.query(
      `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='${name}') CREATE INDEX ${name} ON PatchUpdateLogs (${col}) WHERE IsDeleted = 0`
    );
  }

  // LicenceKeyRef stores a masked display value ("****-****-1234") or a vault-reference string
  // only - never a usable licence key, per spec: "Do not store full licence keys."
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SoftwareInventory' AND xtype='U')
    CREATE TABLE SoftwareInventory (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      AssetId INT NOT NULL REFERENCES Assets(Id) ON DELETE CASCADE,
      SoftwareName NVARCHAR(300) NOT NULL,
      Publisher NVARCHAR(200) NULL,
      InstalledVersion NVARCHAR(100) NULL,
      LatestApprovedVersion NVARCHAR(100) NULL,
      InstallationDate DATE NULL,
      InstalledBy NVARCHAR(200) NULL,
      InstallationSource NVARCHAR(300) NULL,
      LicenceType NVARCHAR(100) NULL,
      LicenceKeyRef NVARCHAR(300) NULL,
      LicenceExpiryDate DATE NULL,
      NumberOfLicences INT NULL,
      BusinessOwner NVARCHAR(200) NULL,
      TechnicalOwner NVARCHAR(200) NULL,
      ApprovalStatus VARCHAR(20) NOT NULL DEFAULT 'PendingApproval',
      SoftwareStatus VARCHAR(20) NOT NULL DEFAULT 'Installed',
      LastUpdatedDate DATE NULL,
      UninstallationDate DATE NULL,
      UninstalledBy NVARCHAR(200) NULL,
      ReasonForRemoval NVARCHAR(500) NULL,
      Notes NVARCHAR(MAX) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      CreatedByUsername NVARCHAR(100) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      UpdatedByUsername NVARCHAR(100) NULL,
      IsDeleted BIT NOT NULL DEFAULT 0,
      DeletedAt DATETIME2 NULL,
      DeletedByUserId INT NULL,
      CONSTRAINT CK_SoftwareInventory_ApprovalStatus CHECK (ApprovalStatus IN ('Approved','PendingApproval','Rejected','NotRequired')),
      CONSTRAINT CK_SoftwareInventory_SoftwareStatus CHECK (SoftwareStatus IN ('Installed','UpdateRequired','Unsupported','Unlicensed','Approved','Unapproved','Removed'))
    )
  `;
  for (const [name, col] of [
    ["IX_SoftwareInventory_AssetId", "AssetId"],
    ["IX_SoftwareInventory_SoftwareStatus", "SoftwareStatus"],
    ["IX_SoftwareInventory_LicenceExpiryDate", "LicenceExpiryDate"],
  ] as const) {
    await db.query(
      `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='${name}') CREATE INDEX ${name} ON SoftwareInventory (${col}) WHERE IsDeleted = 0`
    );
  }

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MaintenanceLogs' AND xtype='U')
    CREATE TABLE MaintenanceLogs (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      AssetId INT NOT NULL REFERENCES Assets(Id) ON DELETE CASCADE,
      ActivityType VARCHAR(30) NOT NULL,
      ActivityTitle NVARCHAR(300) NOT NULL,
      Description NVARCHAR(MAX) NULL,
      ScheduledDate DATE NULL,
      StartAt DATETIME2 NULL,
      CompletedAt DATETIME2 NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Planned',
      Priority VARCHAR(10) NOT NULL DEFAULT 'Medium',
      PerformedBy NVARCHAR(200) NULL,
      RequestedBy NVARCHAR(200) NULL,
      ApprovedBy NVARCHAR(200) NULL,
      DowntimeMinutes INT NULL,
      ServiceImpact NVARCHAR(500) NULL,
      ChangeRequestNumber NVARCHAR(100) NULL,
      IncidentNumber NVARCHAR(100) NULL,
      Result NVARCHAR(1000) NULL,
      FollowUpRequired BIT NOT NULL DEFAULT 0,
      FollowUpDate DATE NULL,
      Notes NVARCHAR(MAX) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      CreatedByUsername NVARCHAR(100) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      UpdatedByUsername NVARCHAR(100) NULL,
      IsDeleted BIT NOT NULL DEFAULT 0,
      DeletedAt DATETIME2 NULL,
      DeletedByUserId INT NULL,
      CONSTRAINT CK_MaintenanceLogs_ActivityType CHECK (ActivityType IN ('PreventiveMaintenance','CorrectiveMaintenance','HardwareReplacement','ConfigurationChange','DatabaseBackup','BackupVerification','RestoreTest','VulnerabilityScan','AntivirusScan','DiskCleanup','PerformanceTuning','AccountReview','SecurityHardening','NetworkConfiguration','OperatingSystemUpgrade','Troubleshooting','Other')),
      CONSTRAINT CK_MaintenanceLogs_Status CHECK (Status IN ('Planned','Scheduled','InProgress','Completed','Failed','Cancelled','Deferred')),
      CONSTRAINT CK_MaintenanceLogs_Priority CHECK (Priority IN ('Critical','High','Medium','Low')),
      CONSTRAINT CK_MaintenanceLogs_DateOrder CHECK (CompletedAt IS NULL OR StartAt IS NULL OR CompletedAt >= StartAt)
    )
  `;
  for (const [name, col] of [
    ["IX_MaintenanceLogs_AssetId", "AssetId"],
    ["IX_MaintenanceLogs_Status", "Status"],
    ["IX_MaintenanceLogs_ScheduledDate", "ScheduledDate"],
  ] as const) {
    await db.query(
      `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='${name}') CREATE INDEX ${name} ON MaintenanceLogs (${col}) WHERE IsDeleted = 0`
    );
  }

  // One row per uploaded file, polymorphic over which of the four log tables it's attached to
  // (exactly one of PasswordChangeLogId/PatchUpdateLogId/SoftwareInventoryId/MaintenanceLogId is
  // set, or none for an asset-level attachment). Only StoredFileName/StoredPath are needed to
  // serve the file - OriginalFileName is display-only and never trusted as a filesystem path.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AssetAttachments' AND xtype='U')
    CREATE TABLE AssetAttachments (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      AssetId INT NOT NULL REFERENCES Assets(Id) ON DELETE CASCADE,
      -- No ON DELETE CASCADE here: MaintenanceLogs already cascades from Assets, so a second
      -- cascade path through this FK to the same AssetAttachments table is rejected by SQL
      -- Server ("may cause cycles or multiple cascade paths"). The AssetId cascade above
      -- already deletes every attachment when its asset is removed; this FK is just an
      -- optional cross-reference to which log entry the file was attached to.
      MaintenanceLogId INT NULL REFERENCES MaintenanceLogs(Id),
      PatchUpdateLogId INT NULL,
      SoftwareInventoryId INT NULL,
      OriginalFileName NVARCHAR(300) NOT NULL,
      StoredFileName VARCHAR(100) NOT NULL,
      ContentType NVARCHAR(150) NOT NULL,
      SizeBytes BIGINT NOT NULL,
      UploadedByUserId INT NULL,
      UploadedByUsername NVARCHAR(100) NULL,
      UploadedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      IsDeleted BIT NOT NULL DEFAULT 0,
      DeletedAt DATETIME2 NULL,
      DeletedByUserId INT NULL
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_AssetAttachments_AssetId')
    CREATE INDEX IX_AssetAttachments_AssetId ON AssetAttachments (AssetId) WHERE IsDeleted = 0
  `;

  // Admin-configurable dropdown values for fields the spec lists as fixed option sets but that
  // technicians will inevitably need to extend (Department, Location, Environment, plus custom
  // additions to DeviceCategory) - Category identifies which dropdown a row belongs to.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ItAssetLookupValues' AND xtype='U')
    CREATE TABLE ItAssetLookupValues (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Category VARCHAR(50) NOT NULL,
      Value NVARCHAR(200) NOT NULL,
      SortOrder INT NOT NULL DEFAULT 0,
      IsActive BIT NOT NULL DEFAULT 1,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CreatedByUserId INT NULL,
      CONSTRAINT UQ_ItAssetLookupValues_Category_Value UNIQUE (Category, Value)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ItAssetNotifications' AND xtype='U')
    CREATE TABLE ItAssetNotifications (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      AlertType VARCHAR(40) NOT NULL,
      AssetId INT NULL REFERENCES Assets(Id) ON DELETE CASCADE,
      SourceTable VARCHAR(30) NULL,
      SourceRecordId INT NULL,
      Severity VARCHAR(20) NOT NULL DEFAULT 'Medium',
      Title NVARCHAR(300) NOT NULL,
      Message NVARCHAR(1000) NULL,
      IsRead BIT NOT NULL DEFAULT 0,
      ReadByUserId INT NULL,
      ReadAt DATETIME2 NULL,
      EmailSentAt DATETIME2 NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_ItAssetNotifications_Severity CHECK (Severity IN ('Critical','High','Medium','Low'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_ItAssetNotifications_IsRead')
    CREATE INDEX IX_ItAssetNotifications_IsRead ON ItAssetNotifications (IsRead, CreatedAt DESC)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ItAssetImportHistory' AND xtype='U')
    CREATE TABLE ItAssetImportHistory (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      TargetTable VARCHAR(30) NOT NULL,
      FileName NVARCHAR(300) NOT NULL,
      TotalRows INT NOT NULL DEFAULT 0,
      ImportedRows INT NOT NULL DEFAULT 0,
      FailedRows INT NOT NULL DEFAULT 0,
      ErrorReportJson NVARCHAR(MAX) NULL,
      ImportedByUserId INT NULL,
      ImportedByUsername NVARCHAR(100) NULL,
      ImportedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  // Singleton settings row (Id always 1) - due-soon thresholds, notification recipients/frequency,
  // escalation config, matching the singleton-settings-table pattern already used for Remote
  // Access (RemoteAccessSettings) and Security Center.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ItAssetSettings' AND xtype='U')
    CREATE TABLE ItAssetSettings (
      Id INT NOT NULL DEFAULT 1 PRIMARY KEY CHECK (Id = 1),
      PasswordDueSoonDays INT NOT NULL DEFAULT 14,
      PatchDueSoonDays INT NOT NULL DEFAULT 7,
      MaintenanceDueSoonDays INT NOT NULL DEFAULT 7,
      WarrantyExpiryWarningDays INT NOT NULL DEFAULT 30,
      LicenceExpiryWarningDays INT NOT NULL DEFAULT 30,
      InventoryCheckIntervalDays INT NOT NULL DEFAULT 90,
      NotificationRecipientsJson NVARCHAR(MAX) NULL,
      NotificationFrequency VARCHAR(20) NOT NULL DEFAULT 'Daily',
      EscalationRecipientsJson NVARCHAR(MAX) NULL,
      EscalationAfterDays INT NULL,
      CriticalAssetsAlertImmediately BIT NOT NULL DEFAULT 1,
      EmailAlertsEnabled BIT NOT NULL DEFAULT 1,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      CONSTRAINT CK_ItAssetSettings_NotificationFrequency CHECK (NotificationFrequency IN ('Immediate','Daily','Weekly'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM ItAssetSettings WHERE Id = 1)
    INSERT INTO ItAssetSettings (Id) VALUES (1)
  `;

  console.log("IT Asset Logsheet Phase 1 schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
