"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
      toast.show({ type: "error", message: "Username is required and password must be at least 8 characters." });
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
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create user");
      toast.show({ type: "success", message: "Employee account created." });
      setCreateOpen(false);
      setCreateForm({ username: "", password: "", fullName: "", email: "", departmentId: "", teamId: "", branchOfficeId: "", jobDesignationId: "" });
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
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
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
      toast.show({ type: "success", message: "Employee account updated." });
      setEditUser(null);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSave(newPassword: string) {
    if (!passwordUser) return;
    if (newPassword.length < 8) {
      toast.show({ type: "error", message: "Password must be at least 8 characters." });
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
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to reset password");
      toast.show({ type: "success", message: "Password reset." });
      setPasswordUser(null);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
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
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to change role");
      toast.show({ type: "success", message: `${roleTarget.user.Username} is now ${roleTarget.nextRole}.` });
      setRoleTarget(null);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3" id="field-employee-accounts">
      <div className="flex items-center justify-between">
        <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>Employee Accounts</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Add Employee
        </Button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              {["Username", "Full Name", "Email", "Department", "Role", "MFA", "Status", ""].map((h) => (
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
                <td style={{ padding: "0.4rem 0.6rem" }}>{u.FullName ?? "—"}</td>
                <td style={{ padding: "0.4rem 0.6rem" }}>{u.Email ?? "—"}</td>
                <td style={{ padding: "0.4rem 0.6rem" }}>{u.DepartmentName ?? "—"}</td>
                <td style={{ padding: "0.4rem 0.6rem" }}>
                  <Badge tone={u.Role === "Admin" ? "info" : "neutral"}>{u.Role}</Badge>
                </td>
                <td style={{ padding: "0.4rem 0.6rem" }}>
                  {u.MfaRequired ? <ShieldCheck size={15} color="var(--success)" /> : <ShieldOff size={15} color="var(--ink-muted)" />}
                </td>
                <td style={{ padding: "0.4rem 0.6rem" }}>
                  <Badge tone={u.IsActive ? "success" : "danger"}>{u.IsActive ? "Active" : "Deactivated"}</Badge>
                </td>
                <td style={{ padding: "0.4rem 0.6rem", whiteSpace: "nowrap" }}>
                  <button onClick={() => setEditUser(u)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontSize: "0.78rem", marginRight: 10 }}>
                    Edit
                  </button>
                  <button onClick={() => setPasswordUser(u)} title="Reset password" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", marginRight: 10 }}>
                    <KeyRound size={14} />
                  </button>
                  {u.Id !== currentUserId && (
                    <button
                      onClick={() => setRoleTarget({ user: u, nextRole: u.Role === "Admin" ? "Employee" : "Admin" })}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", fontSize: "0.78rem" }}
                    >
                      {u.Role === "Admin" ? "Demote" : "Make Admin"}
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
        title="Add Employee Account"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <input style={fieldStyle} placeholder="Username" value={createForm.username} onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} />
          <input style={fieldStyle} type="password" placeholder="Password (min 8 characters)" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
          <input style={fieldStyle} placeholder="Full name" value={createForm.fullName} onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))} />
          <input style={fieldStyle} placeholder="Email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
          <Select value={createForm.departmentId} onChange={(v) => setCreateForm((f) => ({ ...f, departmentId: v }))} options={departmentOptions} placeholder="Department (optional)" />
          <Select value={createForm.teamId} onChange={(v) => setCreateForm((f) => ({ ...f, teamId: v }))} options={teamOptions} placeholder="Team (optional)" />
          <Select value={createForm.branchOfficeId} onChange={(v) => setCreateForm((f) => ({ ...f, branchOfficeId: v }))} options={branchOfficeOptions} placeholder="Branch office (optional)" />
          <Select value={createForm.jobDesignationId} onChange={(v) => setCreateForm((f) => ({ ...f, jobDesignationId: v }))} options={jobDesignationOptions} placeholder="Job designation (optional)" />
        </div>
      </Modal>

      {/* Edit employee modal */}
      {editUser && (
        <Modal
          open
          onClose={() => setEditUser(null)}
          title={`Edit ${editUser.Username}`}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditUser(null)} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleEditSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-2">
            <input style={fieldStyle} placeholder="Full name" value={editUser.FullName ?? ""} onChange={(e) => setEditUser({ ...editUser, FullName: e.target.value })} />
            <input style={fieldStyle} placeholder="Email" value={editUser.Email ?? ""} onChange={(e) => setEditUser({ ...editUser, Email: e.target.value })} />
            <Select value={editUser.DepartmentId ? String(editUser.DepartmentId) : ""} onChange={(v) => setEditUser({ ...editUser, DepartmentId: v ? Number(v) : null })} options={departmentOptions} placeholder="Department" />
            <Select value={editUser.TeamId ? String(editUser.TeamId) : ""} onChange={(v) => setEditUser({ ...editUser, TeamId: v ? Number(v) : null })} options={teamOptions} placeholder="Team" />
            <Select value={editUser.BranchOfficeId ? String(editUser.BranchOfficeId) : ""} onChange={(v) => setEditUser({ ...editUser, BranchOfficeId: v ? Number(v) : null })} options={branchOfficeOptions} placeholder="Branch office" />
            <Select value={editUser.JobDesignationId ? String(editUser.JobDesignationId) : ""} onChange={(v) => setEditUser({ ...editUser, JobDesignationId: v ? Number(v) : null })} options={jobDesignationOptions} placeholder="Job designation" />
            <Switch checked={editUser.MfaRequired} onChange={(v) => setEditUser({ ...editUser, MfaRequired: v })} label="Require Multi-Factor Authentication" />
            {editUser.Id !== currentUserId && (
              <Switch checked={editUser.IsActive} onChange={(v) => setEditUser({ ...editUser, IsActive: v })} label="Account active" />
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
        title={roleTarget?.nextRole === "Admin" ? "Grant Admin access?" : "Remove Admin access?"}
        message={
          roleTarget
            ? `${roleTarget.user.Username} will become ${roleTarget.nextRole === "Admin" ? "an Admin with full access" : "a standard Employee"}.`
            : ""
        }
        confirmLabel={roleTarget?.nextRole === "Admin" ? "Grant Admin" : "Remove Admin"}
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
  return (
    <Modal
      open
      onClose={onClose}
      title={`Reset password for ${user.Username}`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(password)} disabled={saving}>
            {saving ? "Saving..." : "Reset Password"}
          </Button>
        </>
      }
    >
      <input
        style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.83rem" }}
        type="password"
        placeholder="New password (min 8 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </Modal>
  );
}
