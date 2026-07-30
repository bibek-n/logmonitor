import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

const DEFAULT_RULES_JSON = JSON.stringify({
  extensions: [
    "exe", "msi", "bat", "cmd", "com", "scr", "dll", "ps1", "vbs", "js", "jar", "apk", "iso", "img",
  ],
  mimeTypes: [
    "application/x-msdownload",
    "application/x-executable",
    "application/vnd.microsoft.portable-executable",
  ],
  characteristics: {
    executableContent: true,
    doubleExtension: true,
  },
  archiveLimits: {
    maxDepth: 5,
    maxExtractedFiles: 2000,
    maxExtractedSizeBytes: 500 * 1024 * 1024,
    maxCompressionRatio: 100,
    timeoutMs: 15000,
    onPasswordProtected: "Block",
    onCorrupted: "Block",
    onUninspectable: "Block",
  },
});

const DEFAULT_TEMPLATES: Array<{ eventType: string; subject: string; body: string }> = [
  {
    eventType: "IncomingBlocked",
    subject: "Blocked: an incoming email contained prohibited content",
    body: "An incoming email to {{recipient}} from {{sender}} was blocked.\n\nFile: {{file_name}}\nReason: {{block_reason}}\nPolicy: {{policy_name}}\nIncident ID: {{incident_id}}\nTime: {{timestamp}}\n\nContact {{support_email}} if you believe this was blocked in error.",
  },
  {
    eventType: "OutgoingBlocked",
    subject: "Blocked: your outgoing email contained prohibited content",
    body: "Your email to {{recipient}} was blocked before delivery.\n\nFile: {{file_name}}\nReason: {{block_reason}}\nPolicy: {{policy_name}}\nIncident ID: {{incident_id}}\n\nRemove the prohibited content and send again, or contact {{support_email}}.",
  },
  {
    eventType: "AttachmentRemoved",
    subject: "Attachment removed from email: {{subject}}",
    body: "The attachment {{file_name}} was removed from an email between {{sender}} and {{recipient}} because it matched policy \"{{policy_name}}\" ({{block_reason}}). The rest of the message was delivered.\n\nIncident ID: {{incident_id}}",
  },
  {
    eventType: "CloudLinkBlocked",
    subject: "Blocked: cloud file-sharing link removed",
    body: "A cloud file-sharing link was blocked in an email between {{sender}} and {{recipient}}.\n\nReason: {{block_reason}}\nPolicy: {{policy_name}}\nIncident ID: {{incident_id}}\n\nContact {{support_email}} if you believe this was blocked in error.",
  },
  {
    eventType: "PasswordProtectedBlocked",
    subject: "Blocked: password-protected file",
    body: "The file {{file_name}} could not be scanned because it is password-protected, and was blocked under policy \"{{policy_name}}\".\n\nIncident ID: {{incident_id}}\nTime: {{timestamp}}",
  },
  {
    eventType: "InspectionFailed",
    subject: "Blocked: file could not be inspected",
    body: "The file {{file_name}} could not be safely inspected ({{block_reason}}) and was blocked under policy \"{{policy_name}}\".\n\nIncident ID: {{incident_id}}",
  },
  {
    eventType: "Quarantined",
    subject: "Message quarantined: {{subject}}",
    body: "An email between {{sender}} and {{recipient}} was quarantined pending review.\n\nReason: {{block_reason}}\nPolicy: {{policy_name}}\nIncident ID: {{incident_id}}",
  },
  {
    eventType: "AdminAlert",
    subject: "Mail Protection alert: policy \"{{policy_name}}\" matched",
    body: "Policy \"{{policy_name}}\" matched a message between {{sender}} and {{recipient}} at {{timestamp}}.\n\nFile: {{file_name}}\nDetected type: {{detected_type}}\nAction: {{block_reason}}\nIncident ID: {{incident_id}}",
  },
];

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MailProviderConnections' AND xtype='U')
    CREATE TABLE MailProviderConnections (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ProviderType VARCHAR(30) NOT NULL,
      DisplayName NVARCHAR(200) NOT NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'NotConnected',
      ConfigJson NVARCHAR(MAX) NULL,
      EncryptedSecret NVARCHAR(500) NULL,
      LastTestedAt DATETIME2 NULL,
      LastTestResult NVARCHAR(500) NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT CK_MailProviderConnections_ProviderType CHECK (ProviderType IN ('M365','GoogleWorkspace','ExchangeServer','SmtpImap','Generic'))
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MailBlockingPolicies' AND xtype='U')
    CREATE TABLE MailBlockingPolicies (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      Description NVARCHAR(1000) NULL,
      Enabled BIT NOT NULL DEFAULT 1,
      Mandatory BIT NOT NULL DEFAULT 0,
      Direction VARCHAR(20) NOT NULL DEFAULT 'Both',
      Priority INT NOT NULL DEFAULT 100,
      Action VARCHAR(20) NOT NULL,
      RulesJson NVARCHAR(MAX) NOT NULL,
      UrlPatternsJson NVARCHAR(MAX) NULL,
      NotifySender BIT NOT NULL DEFAULT 1,
      NotifyRecipient BIT NOT NULL DEFAULT 1,
      NotifyAdminEmail NVARCHAR(320) NULL,
      CreatedByUserId INT NULL,
      UpdatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      DeletedAt DATETIME2 NULL,
      CONSTRAINT CK_MailBlockingPolicies_Direction CHECK (Direction IN ('Incoming','Outgoing','Both')),
      CONSTRAINT CK_MailBlockingPolicies_Action CHECK (Action IN ('Reject','Block','Quarantine','RemoveAttachment','Warn','Allow')),
      CONSTRAINT CK_MailBlockingPolicies_RulesJson_IsJson CHECK (ISJSON(RulesJson) = 1)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MailPolicyScopes' AND xtype='U')
    CREATE TABLE MailPolicyScopes (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      PolicyId INT NOT NULL,
      ScopeType VARCHAR(20) NOT NULL,
      ScopeValue NVARCHAR(300) NULL,
      CONSTRAINT FK_MailPolicyScopes_Policy FOREIGN KEY (PolicyId) REFERENCES MailBlockingPolicies(Id) ON DELETE CASCADE,
      CONSTRAINT CK_MailPolicyScopes_ScopeType CHECK (ScopeType IN ('Global','Domain','Department','Group','User','Provider'))
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MailPolicyExceptions' AND xtype='U')
    CREATE TABLE MailPolicyExceptions (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      PolicyId INT NULL,
      ExceptionType VARCHAR(30) NOT NULL,
      ExceptionValue NVARCHAR(500) NOT NULL,
      Reason NVARCHAR(500) NOT NULL,
      ApprovedByUserId INT NOT NULL,
      ExpiresAt DATETIME2 NULL,
      RevokedAt DATETIME2 NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_MailPolicyExceptions_Policy FOREIGN KEY (PolicyId) REFERENCES MailBlockingPolicies(Id) ON DELETE CASCADE
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MailNotificationTemplates' AND xtype='U')
    CREATE TABLE MailNotificationTemplates (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      EventType VARCHAR(40) NOT NULL UNIQUE,
      Subject NVARCHAR(300) NOT NULL,
      Body NVARCHAR(MAX) NOT NULL,
      UpdatedByUserId INT NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MailSecurityIncidents' AND xtype='U')
    CREATE TABLE MailSecurityIncidents (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      IncidentId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
      Source VARCHAR(20) NOT NULL DEFAULT 'Simulation',
      ProviderConnectionId INT NULL,
      Direction VARCHAR(20) NOT NULL,
      Sender NVARCHAR(320) NOT NULL,
      Recipients NVARCHAR(2000) NOT NULL,
      Subject NVARCHAR(500) NULL,
      MatchedPolicyId INT NULL,
      ActionTaken VARCHAR(20) NOT NULL,
      BlockReason NVARCHAR(500) NULL,
      ExceptionUsedId INT NULL,
      NotificationStatus NVARCHAR(200) NULL,
      ProcessingTimeMs INT NULL,
      ErrorDetails NVARCHAR(1000) NULL,
      DetectedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_MailSecurityIncidents_Policy FOREIGN KEY (MatchedPolicyId) REFERENCES MailBlockingPolicies(Id),
      CONSTRAINT FK_MailSecurityIncidents_Exception FOREIGN KEY (ExceptionUsedId) REFERENCES MailPolicyExceptions(Id)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MailIncidentAttachments' AND xtype='U')
    CREATE TABLE MailIncidentAttachments (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      IncidentId INT NOT NULL,
      FileName NVARCHAR(500) NOT NULL,
      DeclaredExtension NVARCHAR(20) NULL,
      DetectedFileType NVARCHAR(100) NULL,
      MimeType NVARCHAR(150) NULL,
      FileHash CHAR(64) NULL,
      FileSizeBytes BIGINT NULL,
      InspectionResultJson NVARCHAR(MAX) NULL,
      Blocked BIT NOT NULL DEFAULT 0,
      CONSTRAINT FK_MailIncidentAttachments_Incident FOREIGN KEY (IncidentId) REFERENCES MailSecurityIncidents(Id) ON DELETE CASCADE
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MailIncidentUrls' AND xtype='U')
    CREATE TABLE MailIncidentUrls (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      IncidentId INT NOT NULL,
      OriginalUrl NVARCHAR(1000) NOT NULL,
      ResolvedUrl NVARCHAR(1000) NULL,
      Domain NVARCHAR(300) NULL,
      CloudProvider NVARCHAR(100) NULL,
      Blocked BIT NOT NULL DEFAULT 0,
      Reason NVARCHAR(300) NULL,
      CONSTRAINT FK_MailIncidentUrls_Incident FOREIGN KEY (IncidentId) REFERENCES MailSecurityIncidents(Id) ON DELETE CASCADE
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_MailBlockingPolicies_Enabled')
    CREATE INDEX IX_MailBlockingPolicies_Enabled ON MailBlockingPolicies (Enabled)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_MailPolicyScopes_PolicyId')
    CREATE INDEX IX_MailPolicyScopes_PolicyId ON MailPolicyScopes (PolicyId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_MailPolicyExceptions_PolicyId')
    CREATE INDEX IX_MailPolicyExceptions_PolicyId ON MailPolicyExceptions (PolicyId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_MailSecurityIncidents_DetectedAt')
    CREATE INDEX IX_MailSecurityIncidents_DetectedAt ON MailSecurityIncidents (DetectedAt DESC)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_MailSecurityIncidents_MatchedPolicyId')
    CREATE INDEX IX_MailSecurityIncidents_MatchedPolicyId ON MailSecurityIncidents (MatchedPolicyId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_MailIncidentAttachments_IncidentId')
    CREATE INDEX IX_MailIncidentAttachments_IncidentId ON MailIncidentAttachments (IncidentId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_MailIncidentUrls_IncidentId')
    CREATE INDEX IX_MailIncidentUrls_IncidentId ON MailIncidentUrls (IncidentId)
  `;

  for (const t of DEFAULT_TEMPLATES) {
    await db
      .request()
      .input("eventType", sql.VarChar, t.eventType)
      .input("subject", sql.NVarChar, t.subject)
      .input("body", sql.NVarChar(sql.MAX), t.body)
      .query(
        "IF NOT EXISTS (SELECT * FROM MailNotificationTemplates WHERE EventType = @eventType) INSERT INTO MailNotificationTemplates (EventType, Subject, Body) VALUES (@eventType, @subject, @body)"
      );
  }

  const defaultPolicyExists = await db.query<{ Cnt: number }>(
    "SELECT COUNT(*) AS Cnt FROM MailBlockingPolicies WHERE Name = 'Default Dangerous File Protection'"
  );
  if (defaultPolicyExists.recordset[0].Cnt === 0) {
    const inserted = await db
      .request()
      .input("rulesJson", sql.NVarChar(sql.MAX), DEFAULT_RULES_JSON)
      .query<{ Id: number }>(
        `INSERT INTO MailBlockingPolicies (Name, Description, Enabled, Mandatory, Direction, Priority, Action, RulesJson, NotifySender, NotifyRecipient)
         OUTPUT INSERTED.Id
         VALUES ('Default Dangerous File Protection', 'Blocks executables, scripts, and unsafe archive content on all mail. Does not block PDF or Office documents by default.', 1, 1, 'Both', 10, 'Block', @rulesJson, 1, 1)`
      );
    const policyId = inserted.recordset[0].Id;
    await db
      .request()
      .input("policyId", sql.Int, policyId)
      .query("INSERT INTO MailPolicyScopes (PolicyId, ScopeType, ScopeValue) VALUES (@policyId, 'Global', NULL)");
  }

  console.log("Mail Protection (Mail File Blocking) schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
