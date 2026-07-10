import fs from "fs/promises";
import path from "path";
import { getDb } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { SettingsShell } from "@/components/settings/SettingsShell";

export const dynamic = "force-dynamic";

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
    backupHistoryResult,
    auditLogResult,
    appVersion,
  ] = await Promise.all([
    db.query`SELECT * FROM CompanySettings WHERE Id = 1`,
    db.query`SELECT Id, Name, Description FROM Departments ORDER BY Name ASC`,
    db.query`
      SELECT t.Id, t.Name, t.Description, t.DepartmentId, d.Name AS DepartmentName
      FROM Teams t LEFT JOIN Departments d ON d.Id = t.DepartmentId ORDER BY t.Name ASC
    `,
    db.query`SELECT Id, Name, Address, City, Country, Phone FROM BranchOffices ORDER BY Name ASC`,
    db.query`SELECT Id, Title, Description FROM JobDesignations ORDER BY Title ASC`,
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
    db.query`SELECT Id, Name, Description, IsSystem FROM Roles ORDER BY IsSystem DESC, Name ASC`,
    db.query`
      SELECT g.Id, g.Name, g.Description, COUNT(m.UserId) AS MemberCount
      FROM UserGroups g LEFT JOIN UserGroupMembers m ON m.GroupId = g.Id
      GROUP BY g.Id, g.Name, g.Description ORDER BY g.Name ASC
    `,
    db.query`
      SELECT TOP 200 Id, Username, IpAddress, UserAgent, Success, FailureReason,
        CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
      FROM LoginActivity ORDER BY CreatedAt DESC
    `,
    db.query`SELECT * FROM SecuritySettings WHERE Id = 1`,
    db.query`
      SELECT Host, Port, Username, Encryption, SenderName, SenderEmail, ReplyTo,
        CASE WHEN Password IS NOT NULL AND Password <> '' THEN 1 ELSE 0 END AS PasswordSet,
        CONVERT(VARCHAR(19), LastTestAt, 126) AS LastTestAt, LastTestSuccess, LastTestMessage
      FROM SmtpSettings WHERE Id = 1
    `,
    db.query`
      SELECT TOP 200 Id, ToAddress, Subject, Success, ErrorMessage, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
      FROM EmailDeliveryLog ORDER BY CreatedAt DESC
    `,
    db.query`SELECT ProviderKey, Enabled, ConfigJson FROM Integrations ORDER BY ProviderKey ASC`,
    db.query`SELECT EmailEnabled, SmsEnabled, PushEnabled, InAppEnabled FROM NotificationPreferences WHERE Id = 1`,
    db.query`SELECT Id, [Key], Subject, Body, IsSystem FROM NotificationTemplates ORDER BY [Key] ASC`,
    db.query`SELECT Id, EventName, EmailEnabled, SmsEnabled, PushEnabled, InAppEnabled FROM NotificationRules ORDER BY EventName ASC`,
    db.query`
      SELECT TOP 100 Id, FileName, SizeBytes, Status, ErrorMessage, TriggeredByUsername, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
      FROM BackupHistory ORDER BY CreatedAt DESC
    `,
    db.query`
      SELECT TOP 300 Id, Username, Section, Action, Details, IpAddress, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
      FROM AdminAuditLog ORDER BY CreatedAt DESC
    `,
    getAppVersion(),
  ]);

  const companySettings = companySettingsResult.recordset[0] ?? null;

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
