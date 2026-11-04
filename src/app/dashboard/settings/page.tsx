import fs from "fs/promises";
import path from "path";
import { getDb } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { isSystemModule } from "@/lib/notificationRecipients";

export const dynamic = "force-dynamic";

// This page fans out to ~19 tables in one Promise.all - a single query failing (a transient
// SQL Server resource hiccup, a lock timeout, anything) used to reject the whole Promise.all
// and crash the entire page, even though every other section had its data ready. Wrapping
// each query means one bad section renders empty instead of taking the whole page down; the
// failure is still logged server-side so it's not silently swallowed.
function safeQuery<T>(promise: Promise<{ recordset: T[] }>, label: string): Promise<{ recordset: T[] }> {
  return promise.catch((err) => {
    console.error(`[CompanySettingsPage] ${label} query failed:`, err instanceof Error ? err.message : err);
    return { recordset: [] as T[] };
  });
}

async function getAppVersion(): Promise<string> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "package.json"), "utf8");
    return JSON.parse(raw).version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export default async function CompanySettingsPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Company Settings</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view Company Settings.</p>
      </div>
    );
  }

  const db = await getDb();

  const [
    companySettingsResult,
    departmentsResult,
    teamsResult,
    branchOfficesResult,
    jobDesignationsResult,
    usersResult,
    rolesResult,
    userGroupsResult,
    loginActivityResult,
    securityResult,
    smtpResult,
    emailLogsResult,
    integrationsResult,
    notificationPreferencesResult,
    notificationTemplatesResult,
    notificationRulesResult,
    notificationRecipientsResult,
    webhookSettingsResult,
    backupHistoryResult,
    auditLogResult,
    appVersion,
  ] = await Promise.all([
    safeQuery(db.query`SELECT * FROM CompanySettings WHERE Id = 1`, "CompanySettings"),
    safeQuery(db.query`SELECT Id, Name, Description FROM Departments ORDER BY Name ASC`, "Departments"),
    safeQuery(
      db.query`
        SELECT t.Id, t.Name, t.Description, t.DepartmentId, d.Name AS DepartmentName
        FROM Teams t LEFT JOIN Departments d ON d.Id = t.DepartmentId ORDER BY t.Name ASC
      `,
      "Teams"
    ),
    safeQuery(db.query`SELECT Id, Name, Address, City, Country, Phone FROM BranchOffices ORDER BY Name ASC`, "BranchOffices"),
    safeQuery(db.query`SELECT Id, Title, Description FROM JobDesignations ORDER BY Title ASC`, "JobDesignations"),
    safeQuery(
      db.query`
        SELECT u.Id, u.Username, u.FullName, u.Email, u.Role, u.IsActive, u.MfaRequired, u.CreatedAt,
          u.DepartmentId, d.Name AS DepartmentName, u.TeamId, t.Name AS TeamName,
          u.BranchOfficeId, b.Name AS BranchOfficeName, u.JobDesignationId, j.Title AS JobDesignationTitle
        FROM Users u
        LEFT JOIN Departments d ON d.Id = u.DepartmentId
        LEFT JOIN Teams t ON t.Id = u.TeamId
        LEFT JOIN BranchOffices b ON b.Id = u.BranchOfficeId
        LEFT JOIN JobDesignations j ON j.Id = u.JobDesignationId
        ORDER BY u.Username ASC
      `,
      "Users"
    ),
    safeQuery(db.query`SELECT Id, Name, Description, IsSystem FROM Roles ORDER BY IsSystem DESC, Name ASC`, "Roles"),
    safeQuery(
      db.query`
        SELECT g.Id, g.Name, g.Description, COUNT(m.UserId) AS MemberCount
        FROM UserGroups g LEFT JOIN UserGroupMembers m ON m.GroupId = g.Id
        GROUP BY g.Id, g.Name, g.Description ORDER BY g.Name ASC
      `,
      "UserGroups"
    ),
    safeQuery(
      db.query`
        SELECT TOP 200 Id, Username, IpAddress, UserAgent, Success, FailureReason,
          CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
        FROM LoginActivity ORDER BY CreatedAt DESC
      `,
      "LoginActivity"
    ),
    safeQuery(db.query`SELECT * FROM SecuritySettings WHERE Id = 1`, "SecuritySettings"),
    safeQuery(
      db.query`
        SELECT Host, Port, Username, Encryption, SenderName, SenderEmail, ReplyTo,
          CASE WHEN Password IS NOT NULL AND Password <> '' THEN 1 ELSE 0 END AS PasswordSet,
          CONVERT(VARCHAR(19), LastTestAt, 126) AS LastTestAt, LastTestSuccess, LastTestMessage
        FROM SmtpSettings WHERE Id = 1
      `,
      "SmtpSettings"
    ),
    safeQuery(
      db.query`
        SELECT TOP 200 Id, ToAddress, Subject, Success, ErrorMessage, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
        FROM EmailDeliveryLog ORDER BY CreatedAt DESC
      `,
      "EmailDeliveryLog"
    ),
    safeQuery(db.query`SELECT ProviderKey, Enabled, ConfigJson FROM Integrations ORDER BY ProviderKey ASC`, "Integrations"),
    safeQuery(
      db.query`SELECT EmailEnabled, SmsEnabled, PushEnabled, InAppEnabled FROM NotificationPreferences WHERE Id = 1`,
      "NotificationPreferences"
    ),
    safeQuery(db.query`SELECT Id, [Key], Subject, Body, IsSystem FROM NotificationTemplates ORDER BY [Key] ASC`, "NotificationTemplates"),
    safeQuery(
      db.query`SELECT Id, EventName, EmailEnabled, SmsEnabled, PushEnabled, InAppEnabled FROM NotificationRules ORDER BY EventName ASC`,
      "NotificationRules"
    ),
    safeQuery(
      db.query`SELECT ModuleKey, SubModuleKey, ModuleLabel, SubModuleLabel, Recipients, Enabled FROM NotificationRecipients ORDER BY ModuleLabel ASC, SubModuleLabel ASC`,
      "NotificationRecipients"
    ),
    safeQuery(
      db.query`SELECT Url, Platform, Enabled FROM WebhookSettings WHERE Id = 1`,
      "WebhookSettings"
    ),
    safeQuery(
      db.query`
        SELECT TOP 100 Id, FileName, SizeBytes, Status, ErrorMessage, TriggeredByUsername, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
        FROM BackupHistory ORDER BY CreatedAt DESC
      `,
      "BackupHistory"
    ),
    safeQuery(
      db.query`
        SELECT TOP 300 Id, Username, Section, Action, Details, IpAddress, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
        FROM AdminAuditLog ORDER BY CreatedAt DESC
      `,
      "AdminAuditLog"
    ),
    getAppVersion(),
  ]);

  const companySettings = companySettingsResult.recordset[0] ?? null;

  const notificationRecipients = notificationRecipientsResult.recordset.map(
    (r: { ModuleKey: string; SubModuleKey: string; ModuleLabel: string | null; SubModuleLabel: string | null; Recipients: string; Enabled: boolean }) => ({
      moduleKey: r.ModuleKey,
      subModuleKey: r.SubModuleKey,
      moduleLabel: r.ModuleLabel ?? r.ModuleKey,
      subModuleLabel: r.SubModuleLabel,
      recipients: r.Recipients,
      enabled: r.Enabled,
      isSystem: isSystemModule(r.ModuleKey, r.SubModuleKey),
    })
  );

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Company Settings</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Manage your organization&apos;s profile, structure, access, and platform configuration.
      </p>
      <SettingsShell
        data={{
          companyProfile: companySettings,
          organization: {
            departments: departmentsResult.recordset,
            teams: teamsResult.recordset,
            branchOffices: branchOfficesResult.recordset,
            jobDesignations: jobDesignationsResult.recordset,
          },
          usersAccess: {
            users: usersResult.recordset,
            currentUserId: admin.userId,
            departments: departmentsResult.recordset,
            teams: teamsResult.recordset,
            branchOffices: branchOfficesResult.recordset,
            jobDesignations: jobDesignationsResult.recordset,
            roles: rolesResult.recordset,
            userGroups: userGroupsResult.recordset,
            loginActivity: loginActivityResult.recordset,
          },
          security: securityResult.recordset[0] ?? null,
          smtp: smtpResult.recordset[0] ?? null,
          smtpLogs: emailLogsResult.recordset,
          integrations: integrationsResult.recordset,
          notificationPreferences: notificationPreferencesResult.recordset[0] ?? null,
          notificationTemplates: notificationTemplatesResult.recordset,
          notificationRules: notificationRulesResult.recordset,
          notificationRecipients,
          webhookSettings: webhookSettingsResult.recordset[0] ?? null,
          branding: companySettings,
          backupSchedule: companySettings,
          backupHistory: backupHistoryResult.recordset,
          systemSettings: companySettings,
          appVersion,
          auditLog: auditLogResult.recordset,
        }}
      />
    </div>
  );
}
