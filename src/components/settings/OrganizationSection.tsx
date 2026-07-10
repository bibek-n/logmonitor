"use client";

import { useTranslations } from "next-intl";
import { LookupTableCRUD } from "./LookupTableCRUD";

export interface OrganizationInitialData {
  departments: Record<string, unknown>[];
  teams: Record<string, unknown>[];
  branchOffices: Record<string, unknown>[];
  jobDesignations: Record<string, unknown>[];
}

export function OrganizationSection({ initialData }: { initialData: OrganizationInitialData }) {
  const t = useTranslations("settings.organization");
  const departmentOptions = initialData.departments.map((d) => ({ label: String(d.Name), value: String(d.Id) }));

  return (
    <div className="flex flex-col gap-4">
      <div id="field-departments">
        <LookupTableCRUD
          title={t("departmentsTitle")}
          apiBase="/api/admin/settings/organization/departments"
          rows={initialData.departments}
          fields={[
            { key: "name", label: t("nameLabel"), type: "text", required: true },
            { key: "description", label: t("descriptionLabel"), type: "textarea" },
          ]}
          columns={[
            { key: "Name", label: t("nameLabel") },
            { key: "Description", label: t("descriptionLabel") },
          ]}
        />
      </div>

      <div id="field-teams">
        <LookupTableCRUD
          title={t("teamsTitle")}
          apiBase="/api/admin/settings/organization/teams"
          rows={initialData.teams}
          fields={[
            { key: "name", label: t("nameLabel"), type: "text", required: true },
            { key: "departmentId", label: t("departmentLabel"), type: "select", options: departmentOptions },
            { key: "description", label: t("descriptionLabel"), type: "textarea" },
          ]}
          columns={[
            { key: "Name", label: t("nameLabel") },
            { key: "DepartmentName", label: t("departmentLabel"), render: (r) => String(r.DepartmentName ?? "—") },
            { key: "Description", label: t("descriptionLabel") },
          ]}
        />
      </div>

      <div id="field-branch-offices">
        <LookupTableCRUD
          title={t("branchOfficesTitle")}
          apiBase="/api/admin/settings/organization/branch-offices"
          rows={initialData.branchOffices}
          fields={[
            { key: "name", label: t("nameLabel"), type: "text", required: true },
            { key: "address", label: t("addressLabel"), type: "text" },
            { key: "city", label: t("cityLabel"), type: "text" },
            { key: "country", label: t("countryLabel"), type: "text" },
            { key: "phone", label: t("phoneLabel"), type: "text" },
          ]}
          columns={[
            { key: "Name", label: t("nameLabel") },
            { key: "City", label: t("cityLabel") },
            { key: "Country", label: t("countryLabel") },
            { key: "Phone", label: t("phoneLabel") },
          ]}
        />
      </div>

      <div id="field-job-designations">
        <LookupTableCRUD
          title={t("jobDesignationsTitle")}
          apiBase="/api/admin/settings/organization/job-designations"
          rows={initialData.jobDesignations}
          fields={[
            { key: "title", label: t("titleLabel"), type: "text", required: true },
            { key: "description", label: t("descriptionLabel"), type: "textarea" },
          ]}
          columns={[
            { key: "Title", label: t("titleLabel") },
            { key: "Description", label: t("descriptionLabel") },
          ]}
        />
      </div>
    </div>
  );
}
