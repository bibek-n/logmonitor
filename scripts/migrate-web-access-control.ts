import "dotenv/config";
import { getDb } from "../src/lib/db";

// Staff-based website access control, layered on top of the existing Staff/Devices tables -
// deliberately NOT a parallel staff system. "Username" reuses Staff.AdSamAccountName (already
// populated by AD sync); "IP address or device" reuses the existing MacAddress -> RouterClients/
// SophosClients join every other staff-facing page in this app already relies on. WacGroups is
// a distinct concept from the existing Roles/RolePermissions tables (which gate what an admin
// can do INSIDE this dashboard) - this is about which websites an EMPLOYEE can browse, an
// entirely different axis.
//
// No live Sophos sync yet (see src/lib/webAccessControl/sophosFirewallService.ts) - every rule
// created here is real, stored, and fully enforceable once that adapter is wired up to a
// verified Sophos Firewall API. WacSyncStatus honestly reflects "NotConnected" until then rather
// than pretending anything has been pushed to the firewall.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WacGroups' AND xtype='U')
    CREATE TABLE WacGroups (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL UNIQUE,
      Description NVARCHAR(500) NULL,
      IsBuiltIn BIT NOT NULL DEFAULT 0,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'WacGroupId')
    ALTER TABLE Staff ADD WacGroupId INT NULL REFERENCES WacGroups(Id)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Staff_WacGroupId')
    CREATE INDEX IX_Staff_WacGroupId ON Staff (WacGroupId) WHERE WacGroupId IS NOT NULL
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WacSchedules' AND xtype='U')
    CREATE TABLE WacSchedules (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL,
      DaysOfWeek VARCHAR(20) NULL,
      StartTime TIME NULL,
      EndTime TIME NULL,
      IsBuiltIn BIT NOT NULL DEFAULT 0,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WacWebsiteRules' AND xtype='U')
    CREATE TABLE WacWebsiteRules (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Domain NVARCHAR(255) NOT NULL,
      MatchType VARCHAR(10) NOT NULL DEFAULT 'suffix',
      Action VARCHAR(10) NOT NULL,
      ScopeType VARCHAR(10) NOT NULL,
      StaffId INT NULL REFERENCES Staff(Id),
      WacGroupId INT NULL REFERENCES WacGroups(Id),
      ScheduleId INT NULL REFERENCES WacSchedules(Id),
      Priority VARCHAR(10) NOT NULL DEFAULT 'Normal',
      Status VARCHAR(10) NOT NULL DEFAULT 'Enabled',
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_WacWebsiteRules_Action CHECK (Action IN ('Allow','Block')),
      CONSTRAINT CK_WacWebsiteRules_ScopeType CHECK (ScopeType IN ('Staff','Group','Global')),
      CONSTRAINT CK_WacWebsiteRules_Status CHECK (Status IN ('Enabled','Disabled'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_WacWebsiteRules_MatchType')
    ALTER TABLE WacWebsiteRules WITH CHECK ADD CONSTRAINT CK_WacWebsiteRules_MatchType CHECK (MatchType IN ('exact','suffix'))
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_WacWebsiteRules_Priority')
    ALTER TABLE WacWebsiteRules WITH CHECK ADD CONSTRAINT CK_WacWebsiteRules_Priority CHECK (Priority IN ('Low','Normal','High'))
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WacWebsiteRules_Domain')
    CREATE INDEX IX_WacWebsiteRules_Domain ON WacWebsiteRules (Domain)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WacWebsiteRules_StaffId')
    CREATE INDEX IX_WacWebsiteRules_StaffId ON WacWebsiteRules (StaffId) WHERE StaffId IS NOT NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WacWebsiteRules_WacGroupId')
    CREATE INDEX IX_WacWebsiteRules_WacGroupId ON WacWebsiteRules (WacGroupId) WHERE WacGroupId IS NOT NULL
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WacCriticalAllowlist' AND xtype='U')
    CREATE TABLE WacCriticalAllowlist (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ServiceName NVARCHAR(200) NOT NULL,
      Domain NVARCHAR(255) NULL,
      IpAddress VARCHAR(45) NULL,
      Port INT NULL,
      MatchType VARCHAR(10) NOT NULL DEFAULT 'suffix',
      IsCritical BIT NOT NULL DEFAULT 1,
      Notes NVARCHAR(1000) NULL,
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_WacCriticalAllowlist_HasTarget CHECK (Domain IS NOT NULL OR IpAddress IS NOT NULL)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_WacCriticalAllowlist_MatchType')
    ALTER TABLE WacCriticalAllowlist WITH CHECK ADD CONSTRAINT CK_WacCriticalAllowlist_MatchType CHECK (MatchType IN ('exact','suffix'))
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WacCriticalAllowlist_Domain')
    CREATE INDEX IX_WacCriticalAllowlist_Domain ON WacCriticalAllowlist (Domain) WHERE Domain IS NOT NULL
  `;

  // Sync status is per-rule (WacWebsiteRules or WacCriticalAllowlist), distinguished by
  // PolicyType - a single small table rather than two near-identical ones, since the shape
  // (status/timestamps/error) is identical either way.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WacSyncStatus' AND xtype='U')
    CREATE TABLE WacSyncStatus (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      PolicyType VARCHAR(20) NOT NULL,
      PolicyId INT NOT NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'NotConnected',
      LastAttemptAt DATETIME2 NULL,
      LastSuccessAt DATETIME2 NULL,
      ErrorMessage NVARCHAR(1000) NULL,
      CONSTRAINT CK_WacSyncStatus_PolicyType CHECK (PolicyType IN ('WebsiteRule','CriticalAllowlist')),
      CONSTRAINT CK_WacSyncStatus_Status CHECK (Status IN ('NotConnected','Pending','Synced','Failed'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_WacSyncStatus_Policy')
    CREATE UNIQUE INDEX IX_WacSyncStatus_Policy ON WacSyncStatus (PolicyType, PolicyId)
  `;

  // Seed built-in groups (requirement's example set) - editable/extendable afterward, not
  // hardcoded into application logic anywhere.
  await db.query`
    IF NOT EXISTS (SELECT 1 FROM WacGroups WHERE Name = 'Admin')
    INSERT INTO WacGroups (Name, Description, IsBuiltIn) VALUES
      ('Admin', 'Full access - IT/leadership', 1),
      ('Accounts', 'Finance and accounting staff', 1),
      ('Sales', 'Sales and business development', 1),
      ('HR', 'Human resources', 1),
      ('General Staff', 'Default group for everyone else', 1)
  `;

  // Seed built-in schedules.
  await db.query`
    IF NOT EXISTS (SELECT 1 FROM WacSchedules WHERE Name = 'Always')
    INSERT INTO WacSchedules (Name, DaysOfWeek, StartTime, EndTime, IsBuiltIn) VALUES
      ('Always', NULL, NULL, NULL, 1),
      ('Working Hours', 'Mon,Tue,Wed,Thu,Fri', '09:00', '18:00', 1),
      ('Lunch Break', 'Mon,Tue,Wed,Thu,Fri', '13:00', '14:00', 1)
  `;

  // Example policies from the approved spec, seeded as Group-scoped rules referencing the
  // groups/schedules above. Idempotent (checked by exact Domain+ScopeType+target+Action
  // before inserting) so this is safe to re-run.
  //
  // Substitution note: the spec's example set says "youtube.com -> Allow for Marketing", but
  // this company's seeded Staff Group list (per the spec's own group list above) is
  // Admin/Accounts/Sales/HR/General Staff - there is no "Marketing" group. Rather than
  // inventing a 6th group that nothing else in the spec asked for, this reuses "Sales" as
  // the closest real seeded group (marketing-adjacent, needs YouTube for ads/content
  // research) - simplest option, documented here rather than silently guessed.
  await db.query`
    IF NOT EXISTS (
      SELECT 1 FROM WacWebsiteRules r JOIN WacGroups g ON g.Id = r.WacGroupId
      WHERE r.Domain = 'facebook.com' AND r.ScopeType = 'Group' AND g.Name = 'General Staff' AND r.Action = 'Block'
    )
    INSERT INTO WacWebsiteRules (Domain, MatchType, Action, ScopeType, WacGroupId, ScheduleId, Priority, Status)
    SELECT 'facebook.com', 'suffix', 'Block', 'Group', g.Id, s.Id, 'Normal', 'Enabled'
    FROM WacGroups g CROSS JOIN WacSchedules s
    WHERE g.Name = 'General Staff' AND s.Name = 'Working Hours'
  `;

  await db.query`
    IF NOT EXISTS (
      SELECT 1 FROM WacWebsiteRules r JOIN WacGroups g ON g.Id = r.WacGroupId
      WHERE r.Domain = 'youtube.com' AND r.ScopeType = 'Group' AND g.Name = 'Sales' AND r.Action = 'Allow'
    )
    INSERT INTO WacWebsiteRules (Domain, MatchType, Action, ScopeType, WacGroupId, ScheduleId, Priority, Status)
    SELECT 'youtube.com', 'suffix', 'Allow', 'Group', g.Id, NULL, 'Normal', 'Enabled'
    FROM WacGroups g
    WHERE g.Name = 'Sales'
  `;

  await db.query`
    IF NOT EXISTS (
      SELECT 1 FROM WacWebsiteRules r JOIN WacGroups g ON g.Id = r.WacGroupId
      WHERE r.Domain = 'linkedin.com' AND r.ScopeType = 'Group' AND g.Name = 'HR' AND r.Action = 'Allow'
    )
    INSERT INTO WacWebsiteRules (Domain, MatchType, Action, ScopeType, WacGroupId, ScheduleId, Priority, Status)
    SELECT 'linkedin.com', 'suffix', 'Allow', 'Group', g.Id, NULL, 'Normal', 'Enabled'
    FROM WacGroups g
    WHERE g.Name = 'HR'
  `;
  await db.query`
    IF NOT EXISTS (
      SELECT 1 FROM WacWebsiteRules r JOIN WacGroups g ON g.Id = r.WacGroupId
      WHERE r.Domain = 'linkedin.com' AND r.ScopeType = 'Group' AND g.Name = 'Sales' AND r.Action = 'Allow'
    )
    INSERT INTO WacWebsiteRules (Domain, MatchType, Action, ScopeType, WacGroupId, ScheduleId, Priority, Status)
    SELECT 'linkedin.com', 'suffix', 'Allow', 'Group', g.Id, NULL, 'Normal', 'Enabled'
    FROM WacGroups g
    WHERE g.Name = 'Sales'
  `;

  await db.query`
    IF NOT EXISTS (
      SELECT 1 FROM WacWebsiteRules r JOIN WacGroups g ON g.Id = r.WacGroupId
      WHERE r.Domain = 'gmail.com' AND r.ScopeType = 'Group' AND g.Name = 'Admin' AND r.Action = 'Allow'
    )
    INSERT INTO WacWebsiteRules (Domain, MatchType, Action, ScopeType, WacGroupId, ScheduleId, Priority, Status)
    SELECT 'gmail.com', 'suffix', 'Allow', 'Group', g.Id, NULL, 'Normal', 'Enabled'
    FROM WacGroups g
    WHERE g.Name = 'Admin'
  `;

  // A handful of obviously-generic Critical Allowlist placeholders so the allowlist page
  // isn't empty on first load - deliberately fake/generic names and domains, not this
  // company's real infrastructure (per the hard constraint against committing real
  // infra/secrets - this migration script itself is generic and reusable, not
  // environment-specific).
  await db.query`
    IF NOT EXISTS (SELECT 1 FROM WacCriticalAllowlist WHERE ServiceName = 'Company Intranet')
    INSERT INTO WacCriticalAllowlist (ServiceName, Domain, MatchType, IsCritical, Notes) VALUES
      ('Company Intranet', 'intranet.example-corp.local', 'suffix', 1, 'Placeholder example - replace with the real internal intranet hostname.')
  `;
  await db.query`
    IF NOT EXISTS (SELECT 1 FROM WacCriticalAllowlist WHERE ServiceName = 'Payroll System')
    INSERT INTO WacCriticalAllowlist (ServiceName, Domain, MatchType, IsCritical, Notes) VALUES
      ('Payroll System', 'payroll.example-corp.local', 'suffix', 1, 'Placeholder example - replace with the real payroll provider domain.')
  `;
  await db.query`
    IF NOT EXISTS (SELECT 1 FROM WacCriticalAllowlist WHERE ServiceName = 'Business Email (Office 365 / Google Workspace)')
    INSERT INTO WacCriticalAllowlist (ServiceName, Domain, MatchType, IsCritical, Notes) VALUES
      ('Business Email (Office 365 / Google Workspace)', 'outlook.office365.com', 'suffix', 1, 'Placeholder example - core business email must never be accidentally blocked by a website rule.')
  `;

  console.log("Web Access Control schema ready (WacGroups, WacSchedules, WacWebsiteRules, WacCriticalAllowlist, WacSyncStatus created and seeded).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
