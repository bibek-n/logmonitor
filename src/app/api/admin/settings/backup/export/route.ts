import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

// Exports the Company Settings configuration tables (not operational/monitoring data, and
// never secrets like SmtpSettings.Password or Users.PasswordHash) as a downloadable JSON
// snapshot — a config backup, not a full database dump.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const [companySettings, departments, teams, branchOffices, jobDesignations, roles, userGroups, notificationTemplates, notificationRules, integrations, securitySettings] =
    await Promise.all([
      db.query`SELECT CompanyName, WebsiteUrl, Industry, CompanySize, AddressLine1, AddressLine2, City, State, PostalCode, Country, ContactEmail, ContactPhone, PrimaryColor, SecondaryColor, DefaultTimezone, DefaultLanguage, DateFormat, TimeFormat FROM CompanySettings WHERE Id = 1`,
      db.query`SELECT Name, Description FROM Departments`,
      db.query`SELECT Name, DepartmentId, Description FROM Teams`,
      db.query`SELECT Name, Address, City, Country, Phone FROM BranchOffices`,
      db.query`SELECT Title, Description FROM JobDesignations`,
      db.query`SELECT Name, Description, IsSystem FROM Roles`,
      db.query`SELECT Name, Description FROM UserGroups`,
      db.query`SELECT [Key], Subject, Body FROM NotificationTemplates`,
      db.query`SELECT EventName, EmailEnabled, SmsEnabled, PushEnabled, InAppEnabled FROM NotificationRules`,
      db.query`SELECT ProviderKey, Enabled FROM Integrations`,
      db.query`SELECT PasswordMinLength, PasswordRequireUppercase, PasswordRequireNumber, PasswordRequireSymbol, SsoEnabled, SessionTimeoutMinutes, LockoutThreshold, LockoutDurationMinutes FROM SecuritySettings WHERE Id = 1`,
    ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    companySettings: companySettings.recordset[0] ?? null,
    departments: departments.recordset,
    teams: teams.recordset,
    branchOffices: branchOffices.recordset,
    jobDesignations: jobDesignations.recordset,
    roles: roles.recordset,
    userGroups: userGroups.recordset,
    notificationTemplates: notificationTemplates.recordset,
    notificationRules: notificationRules.recordset,
    integrations: integrations.recordset,
    securitySettings: securitySettings.recordset[0] ?? null,
  };

  await logAdminAction({ admin, section: "backup_data", action: "export_config", req });

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="logmonitor-settings-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
