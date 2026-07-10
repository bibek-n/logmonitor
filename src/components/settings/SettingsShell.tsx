"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ToastProvider } from "@/components/ui/Toast";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SETTINGS_SECTIONS } from "@/lib/settingsSearchIndex";
import { SettingsNav } from "./SettingsNav";
import { SettingsSearch } from "./SettingsSearch";
import { CompanyProfileSection } from "./CompanyProfileSection";
import { OrganizationSection } from "./OrganizationSection";
import { UsersAccessSection } from "./UsersAccessSection";
import { SecuritySection } from "./SecuritySection";
import { SmtpEmailSection } from "./SmtpEmailSection";
import { IntegrationsSection } from "./IntegrationsSection";
import { NotificationsSection } from "./NotificationsSection";
import { BrandingSection } from "./BrandingSection";
import { BackupDataSection } from "./BackupDataSection";
import { SystemSettingsSection } from "./SystemSettingsSection";
import { AuditLogSection } from "./AuditLogSection";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SettingsInitialData {
  companyProfile: any;
  organization: any;
  usersAccess: any;
  security: any;
  smtp: any;
  smtpLogs: any;
  integrations: any;
  notificationPreferences: any;
  notificationTemplates: any;
  notificationRules: any;
  branding: any;
  backupSchedule: any;
  backupHistory: any;
  systemSettings: any;
  appVersion: string;
  auditLog: any;
}

function SettingsContent({ active, data }: { active: string; data: SettingsInitialData }) {
  switch (active) {
    case "company-profile":
      return <CompanyProfileSection initialData={data.companyProfile} />;
    case "organization":
      return <OrganizationSection initialData={data.organization} />;
    case "users-access":
      return <UsersAccessSection initialData={data.usersAccess} />;
    case "security":
      return <SecuritySection initialData={data.security} />;
    case "smtp-email":
      return <SmtpEmailSection initialData={data.smtp} initialLogs={data.smtpLogs} />;
    case "integrations":
      return <IntegrationsSection rows={data.integrations} />;
    case "notifications":
      return (
        <NotificationsSection
          initialPreferences={data.notificationPreferences}
          initialTemplates={data.notificationTemplates}
          initialRules={data.notificationRules}
        />
      );
    case "branding":
      return <BrandingSection initialData={data.branding} />;
    case "backup-data":
      return <BackupDataSection initialSchedule={data.backupSchedule} initialHistory={data.backupHistory} />;
    case "system":
      return <SystemSettingsSection initialData={data.systemSettings} appVersion={data.appVersion} />;
    case "audit-log":
      return <AuditLogSection rows={data.auditLog} />;
    default:
      return null;
  }
}

function ShellInner({ data }: { data: SettingsInitialData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(searchParams.get("section") ?? "company-profile");

  function goToSection(key: string) {
    setActive(key);
    router.replace(`/dashboard/settings?section=${key}`, { scroll: false });
  }

  function handleSearchNavigate(sectionKey: string, fieldId: string) {
    goToSection(sectionKey);
    setTimeout(() => {
      const el = document.getElementById(`field-${fieldId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("settings-field-highlight");
        setTimeout(() => el.classList.remove("settings-field-highlight"), 1500);
      }
    }, 60);
  }

  const activeLabel = SETTINGS_SECTIONS.find((s) => s.key === active)?.label ?? "Company Profile";

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: "1rem" }}>
        <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Company Settings" }, { label: activeLabel }]} />
        <SettingsSearch onNavigate={handleSearchNavigate} />
      </div>

      <div className="flex gap-6" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <SettingsNav active={active} onSelect={goToSection} />
        <div style={{ flex: 1, minWidth: 280 }}>
          <SettingsContent active={active} data={data} />
        </div>
      </div>
    </div>
  );
}

export function SettingsShell({ data }: { data: SettingsInitialData }) {
  return (
    <ToastProvider>
      <ShellInner data={data} />
    </ToastProvider>
  );
}
