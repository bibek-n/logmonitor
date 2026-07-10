"use client";

import { EmployeeAccountsPanel } from "./EmployeeAccountsPanel";
import { RolesPermissionsPanel } from "./RolesPermissionsPanel";
import { UserGroupsPanel } from "./UserGroupsPanel";
import { LoginActivityPanel } from "./LoginActivityPanel";

export interface UsersAccessInitialData {
  users: Record<string, unknown>[];
  currentUserId: number;
  departments: Record<string, unknown>[];
  teams: Record<string, unknown>[];
  branchOffices: Record<string, unknown>[];
  jobDesignations: Record<string, unknown>[];
  roles: Record<string, unknown>[];
  userGroups: Record<string, unknown>[];
  loginActivity: Record<string, unknown>[];
}

export function UsersAccessSection({ initialData }: { initialData: UsersAccessInitialData }) {
  const departmentOptions = initialData.departments.map((d) => ({ label: String(d.Name), value: String(d.Id) }));
  const teamOptions = initialData.teams.map((t) => ({ label: String(t.Name), value: String(t.Id) }));
  const branchOfficeOptions = initialData.branchOffices.map((b) => ({ label: String(b.Name), value: String(b.Id) }));
  const jobDesignationOptions = initialData.jobDesignations.map((j) => ({ label: String(j.Title), value: String(j.Id) }));
  const userOptions = initialData.users.map((u) => ({ label: String(u.Username), value: String(u.Id) }));

  return (
    <div className="flex flex-col gap-4">
      <EmployeeAccountsPanel
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        users={initialData.users as any}
        currentUserId={initialData.currentUserId}
        departmentOptions={departmentOptions}
        teamOptions={teamOptions}
        branchOfficeOptions={branchOfficeOptions}
        jobDesignationOptions={jobDesignationOptions}
      />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <RolesPermissionsPanel roles={initialData.roles as any} />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <UserGroupsPanel groups={initialData.userGroups as any} userOptions={userOptions} />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <LoginActivityPanel rows={initialData.loginActivity as any} />
    </div>
  );
}
