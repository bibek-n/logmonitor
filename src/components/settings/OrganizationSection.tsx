"use client";

import { LookupTableCRUD } from "./LookupTableCRUD";

export interface OrganizationInitialData {
  departments: Record<string, unknown>[];
  teams: Record<string, unknown>[];
  branchOffices: Record<string, unknown>[];
  jobDesignations: Record<string, unknown>[];
}

export function OrganizationSection({ initialData }: { initialData: OrganizationInitialData }) {
  const departmentOptions = initialData.departments.map((d) => ({ label: String(d.Name), value: String(d.Id) }));

  return (
    <div className="flex flex-col gap-4">
      <div id="field-departments">
        <LookupTableCRUD
          title="Departments"
          apiBase="/api/admin/settings/organization/departments"
          rows={initialData.departments}
          fields={[
            { key: "name", label: "Name", type: "text", required: true },
            { key: "description", label: "Description", type: "textarea" },
          ]}
          columns={[
            { key: "Name", label: "Name" },
            { key: "Description", label: "Description" },
          ]}
        />
      </div>

      <div id="field-teams">
        <LookupTableCRUD
          title="Teams"
          apiBase="/api/admin/settings/organization/teams"
          rows={initialData.teams}
          fields={[
            { key: "name", label: "Name", type: "text", required: true },
            { key: "departmentId", label: "Department", type: "select", options: departmentOptions },
            { key: "description", label: "Description", type: "textarea" },
          ]}
          columns={[
            { key: "Name", label: "Name" },
            { key: "DepartmentName", label: "Department", render: (r) => String(r.DepartmentName ?? "—") },
            { key: "Description", label: "Description" },
          ]}
        />
      </div>

      <div id="field-branch-offices">
        <LookupTableCRUD
          title="Branch Offices"
          apiBase="/api/admin/settings/organization/branch-offices"
          rows={initialData.branchOffices}
          fields={[
            { key: "name", label: "Name", type: "text", required: true },
            { key: "address", label: "Address", type: "text" },
            { key: "city", label: "City", type: "text" },
            { key: "country", label: "Country", type: "text" },
            { key: "phone", label: "Phone", type: "text" },
          ]}
          columns={[
            { key: "Name", label: "Name" },
            { key: "City", label: "City" },
            { key: "Country", label: "Country" },
            { key: "Phone", label: "Phone" },
          ]}
        />
      </div>

      <div id="field-job-designations">
        <LookupTableCRUD
          title="Job Designations"
          apiBase="/api/admin/settings/organization/job-designations"
          rows={initialData.jobDesignations}
          fields={[
            { key: "title", label: "Title", type: "text", required: true },
            { key: "description", label: "Description", type: "textarea" },
          ]}
          columns={[
            { key: "Title", label: "Title" },
            { key: "Description", label: "Description" },
          ]}
        />
      </div>
    </div>
  );
}
