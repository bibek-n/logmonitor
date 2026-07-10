"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

interface UserRow {
  Id: number;
  Username: string;
  FullName: string | null;
  Email: string | null;
  Role: string;
  IsActive: boolean;
  MfaRequired: boolean;
  DepartmentId: number | null;
  DepartmentName: string | null;
  TeamId: number | null;
  TeamName: string | null;
  BranchOfficeId: number | null;
  BranchOfficeName: string | null;
  JobDesignationId: number | null;
  JobDesignationTitle: string | null;
}

interface Option {
  label: string;
  value: string;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.83rem",
};

export function EmployeeAccountsPanel({
  users,
  currentUserId,
  departmentOptions,
  teamOptions,
  branchOfficeOptions,
  jobDesignationOptions,
}: {
  users: UserRow[];
  currentUserId: number;
  departmentOptions: Option[];
  teamOptions: Option[];
  branchOfficeOptions: Option[];
  jobDesignationOptions: Option[];
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("settings.employeeAccounts");
  const roleLabel = (role: string) => (role === "Admin" ? t("roleAdmin") : t("roleEmployee"));
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);
  const [roleTarget, setRoleTarget] = useState<{ user: UserRow; nextRole: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    departmentId: "",
    teamId: "",
    branchOfficeId: "",
    jobDesignationId: "",
  });

  async function handleCreate() {
    if (!createForm.username.trim() || createForm.password.length < 8) {
      toast.show({ type: "error", message: t("createValidationError") });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          departmentId: createForm.departmentId ? Number(createForm.departmentId) : null,
          teamId: createForm.teamId ? Number(createForm.teamId) : null,
          branchOfficeId: createForm.branchOfficeId ? Number(createForm.branchOfficeId) : null,
          jobDesignationId: createForm.jobDesignationId ? Number(createForm.jobDesignationId) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("createFailedError"));
      toast.show({ type: "success", message: t("createSuccessToast") });
      setCreateOpen(false);
      setCreateForm({ username: "", password: "", fullName: "", email: "", departmentId: "", teamId: "", branchOfficeId: "", jobDesignationId: "" });
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("genericError") });
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave() {
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/settings/users/${editUser.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editUser.FullName,
          email: editUser.Email,
          departmentId: editUser.DepartmentId,
          teamId: editUser.TeamId,
          branchOfficeId: editUser.BranchOfficeId,
          jobDesignationId: editUser.JobDesignationId,
          isActive: editUser.IsActive,
          mfaRequired: editUser.MfaRequired,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("editFailedError"));
      toast.show({ type: "success", message: t("editSuccessToast") });
      setEditUser(null);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("genericError") });
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSave(newPassword: string) {
    if (!passwordUser) return;
    if (newPassword.length < 8) {
      toast.show({ type: "error", message: t("passwordValidationError") });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/settings/users/${passwordUser.Id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("passwordFailedError"));
      toast.show({ type: "success", message: t("passwordSuccessToast") });
      setPasswordUser(null);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("genericError") });
    } finally {
      setSaving(false);
    }
  }

  async function confirmRoleChange() {
    if (!roleTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/settings/users/${roleTarget.user.Id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: roleTarget.nextRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("roleFailedError"));
      toast.show({
        type: "success",
        message: t("roleChangedToast", { username: roleTarget.user.Username, role: roleLabel(roleTarget.nextRole) }),
      });
      setRoleTarget(null);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("genericError") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3" id="field-employee-accounts">
      <div className="flex items-center justify-between">
        <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>{t("title")}</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> {t("addEmployeeButton")}
        </Button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              {[
                t("columns.username"),
                t("columns.fullName"),
                t("columns.email"),
                t("columns.department"),
                t("columns.role"),
                t("columns.mfa"),
                t("columns.status"),
                "",
              ].map((h) => (
                <th key={h} style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.4rem 0.6rem" }}>{u.Username}</td>
                <td style={{ padding: "0.4rem 0.6rem" }}>{u.FullName ?? t("notAvailable")}</td>
                <td style={{ padding: "0.4rem 0.6rem" }}>{u.Email ?? t("notAvailable")}</td>
                <td style={{ padding: "0.4rem 0.6rem" }}>{u.DepartmentName ?? t("notAvailable")}</td>
                <td style={{ padding: "0.4rem 0.6rem" }}>
                  <Badge tone={u.Role === "Admin" ? "info" : "neutral"}>{roleLabel(u.Role)}</Badge>
                </td>
                <td style={{ padding: "0.4rem 0.6rem" }}>
                  {u.MfaRequired ? <ShieldCheck size={15} color="var(--success)" /> : <ShieldOff size={15} color="var(--ink-muted)" />}
                </td>
                <td style={{ padding: "0.4rem 0.6rem" }}>
                  <Badge tone={u.IsActive ? "success" : "danger"}>{u.IsActive ? t("statusActive") : t("statusDeactivated")}</Badge>
                </td>
                <td style={{ padding: "0.4rem 0.6rem", whiteSpace: "nowrap" }}>
                  <button onClick={() => setEditUser(u)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontSize: "0.78rem", marginRight: 10 }}>
                    {t("editButton")}
                  </button>
                  <button onClick={() => setPasswordUser(u)} title={t("resetPasswordTooltip")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", marginRight: 10 }}>
                    <KeyRound size={14} />
                  </button>
                  {u.Id !== currentUserId && (
                    <button
                      onClick={() => setRoleTarget({ user: u, nextRole: u.Role === "Admin" ? "Employee" : "Admin" })}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", fontSize: "0.78rem" }}
                    >
                      {u.Role === "Admin" ? t("demoteButton") : t("makeAdminButton")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create employee modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("addModalTitle")}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(false)} disabled={saving}>
              {t("cancelButton")}
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving ? t("creatingButton") : t("createButton")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <input style={fieldStyle} placeholder={t("usernamePlaceholder")} value={createForm.username} onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} />
          <input style={fieldStyle} type="password" placeholder={t("passwordPlaceholder")} value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
          <input style={fieldStyle} placeholder={t("fullNamePlaceholder")} value={createForm.fullName} onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))} />
          <input style={fieldStyle} placeholder={t("emailPlaceholder")} value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
          <Select value={createForm.departmentId} onChange={(v) => setCreateForm((f) => ({ ...f, departmentId: v }))} options={departmentOptions} placeholder={t("departmentOptionalPlaceholder")} />
          <Select value={createForm.teamId} onChange={(v) => setCreateForm((f) => ({ ...f, teamId: v }))} options={teamOptions} placeholder={t("teamOptionalPlaceholder")} />
          <Select value={createForm.branchOfficeId} onChange={(v) => setCreateForm((f) => ({ ...f, branchOfficeId: v }))} options={branchOfficeOptions} placeholder={t("branchOfficeOptionalPlaceholder")} />
          <Select value={createForm.jobDesignationId} onChange={(v) => setCreateForm((f) => ({ ...f, jobDesignationId: v }))} options={jobDesignationOptions} placeholder={t("jobDesignationOptionalPlaceholder")} />
        </div>
      </Modal>

      {/* Edit employee modal */}
      {editUser && (
        <Modal
          open
          onClose={() => setEditUser(null)}
          title={t("editModalTitle", { username: editUser.Username })}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditUser(null)} disabled={saving}>
                {t("cancelButton")}
              </Button>
              <Button size="sm" onClick={handleEditSave} disabled={saving}>
                {saving ? t("savingButton") : t("saveButton")}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-2">
            <input style={fieldStyle} placeholder={t("fullNamePlaceholder")} value={editUser.FullName ?? ""} onChange={(e) => setEditUser({ ...editUser, FullName: e.target.value })} />
            <input style={fieldStyle} placeholder={t("emailPlaceholder")} value={editUser.Email ?? ""} onChange={(e) => setEditUser({ ...editUser, Email: e.target.value })} />
            <Select value={editUser.DepartmentId ? String(editUser.DepartmentId) : ""} onChange={(v) => setEditUser({ ...editUser, DepartmentId: v ? Number(v) : null })} options={departmentOptions} placeholder={t("departmentPlaceholder")} />
            <Select value={editUser.TeamId ? String(editUser.TeamId) : ""} onChange={(v) => setEditUser({ ...editUser, TeamId: v ? Number(v) : null })} options={teamOptions} placeholder={t("teamPlaceholder")} />
            <Select value={editUser.BranchOfficeId ? String(editUser.BranchOfficeId) : ""} onChange={(v) => setEditUser({ ...editUser, BranchOfficeId: v ? Number(v) : null })} options={branchOfficeOptions} placeholder={t("branchOfficePlaceholder")} />
            <Select value={editUser.JobDesignationId ? String(editUser.JobDesignationId) : ""} onChange={(v) => setEditUser({ ...editUser, JobDesignationId: v ? Number(v) : null })} options={jobDesignationOptions} placeholder={t("jobDesignationPlaceholder")} />
            <Switch checked={editUser.MfaRequired} onChange={(v) => setEditUser({ ...editUser, MfaRequired: v })} label={t("mfaSwitchLabel")} />
            {editUser.Id !== currentUserId && (
              <Switch checked={editUser.IsActive} onChange={(v) => setEditUser({ ...editUser, IsActive: v })} label={t("accountActiveSwitchLabel")} />
            )}
          </div>
        </Modal>
      )}

      {/* Reset password modal */}
      {passwordUser && (
        <PasswordResetModal user={passwordUser} saving={saving} onClose={() => setPasswordUser(null)} onSave={handlePasswordSave} />
      )}

      <ConfirmDialog
        open={roleTarget !== null}
        onClose={() => setRoleTarget(null)}
        onConfirm={confirmRoleChange}
        title={roleTarget?.nextRole === "Admin" ? t("grantAdminTitle") : t("removeAdminTitle")}
        message={
          roleTarget
            ? roleTarget.nextRole === "Admin"
              ? t("roleChangeMessageAdmin", { username: roleTarget.user.Username })
              : t("roleChangeMessageEmployee", { username: roleTarget.user.Username })
            : ""
        }
        confirmLabel={roleTarget?.nextRole === "Admin" ? t("grantAdminConfirmLabel") : t("removeAdminConfirmLabel")}
        tone={roleTarget?.nextRole === "Admin" ? "primary" : "danger"}
        loading={saving}
      />
    </Card>
  );
}

function PasswordResetModal({
  user,
  saving,
  onClose,
  onSave,
}: {
  user: UserRow;
  saving: boolean;
  onClose: () => void;
  onSave: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const t = useTranslations("settings.employeeAccounts");
  return (
    <Modal
      open
      onClose={onClose}
      title={t("resetPasswordModalTitle", { username: user.Username })}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            {t("cancelButton")}
          </Button>
          <Button size="sm" onClick={() => onSave(password)} disabled={saving}>
            {saving ? t("savingButton") : t("resetPasswordButton")}
          </Button>
        </>
      }
    >
      <input
        style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.83rem" }}
        type="password"
        placeholder={t("newPasswordPlaceholder")}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </Modal>
  );
}
