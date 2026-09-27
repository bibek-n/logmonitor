"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface GroupRow {
  Id: number;
  Name: string;
  Description: string | null;
  IsBuiltIn: boolean;
  StaffCount: number;
}

interface StaffRow {
  Id: number;
  Name: string;
  Department: string | null;
  AdSamAccountName: string | null;
  MacAddress: string | null;
  WacGroupId: number | null;
  WacGroupName: string | null;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function GroupsInner() {
  const toast = useToast();
  const [groups, setGroups] = useState<GroupRow[] | null>(null);
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GroupRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [groupsRes, staffRes] = await Promise.all([
      fetch("/api/admin/web-access-control/groups"),
      fetch("/api/admin/web-access-control/staff"),
    ]);
    const groupsData = await groupsRes.json();
    const staffData = await staffRes.json();
    if (groupsRes.ok && groupsData.ok) setGroups(groupsData.data);
    if (staffRes.ok && staffData.ok) setStaff(staffData.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setModalOpen(true);
  }

  function openEdit(g: GroupRow) {
    setEditing(g);
    setName(g.Name);
    setDescription(g.Description ?? "");
    setModalOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      toast.show({ type: "error", message: "Group name is required." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/admin/web-access-control/groups/${editing.Id}` : "/api/admin/web-access-control/groups", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save group.");
      toast.show({ type: "success", message: editing ? "Group updated." : "Group created." });
      setModalOpen(false);
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save group." });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/web-access-control/groups/${deleteTarget.Id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to delete group.");
      toast.show({ type: "success", message: "Group deleted." });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to delete group." });
    } finally {
      setSaving(false);
    }
  }

  async function assignGroup(staffId: number, wacGroupId: string) {
    const res = await fetch(`/api/admin/web-access-control/staff/${staffId}/group`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wacGroupId: wacGroupId ? Number(wacGroupId) : null }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to assign group." });
      return;
    }
    await load();
  }

  return (
    <div>
      <Card style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Groups</h2>
          <Button size="sm" onClick={openCreate}>Add Group</Button>
        </div>
        {groups === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Description</th>
                  <th style={{ padding: "0.4rem" }}>Staff</th>
                  <th style={{ padding: "0.4rem" }}></th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>
                      {g.Name} {g.IsBuiltIn && <Badge tone="info">Built-in</Badge>}
                    </td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{g.Description ?? "-"}</td>
                    <td style={{ padding: "0.4rem" }}>{g.StaffCount}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <button onClick={() => openEdit(g)} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.8rem" }}>
                        Edit
                      </button>
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      {!g.IsBuiltIn && (
                        <button onClick={() => setDeleteTarget(g)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.8rem" }}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.75rem" }}>Staff Roster - Group Assignment</h2>
        {staff === null || groups === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Department</th>
                  <th style={{ padding: "0.4rem" }}>Username</th>
                  <th style={{ padding: "0.4rem" }}>Group</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{s.Name}</td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{s.Department ?? "-"}</td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{s.AdSamAccountName ?? "-"}</td>
                    <td style={{ padding: "0.4rem", maxWidth: 220 }}>
                      <Select
                        value={s.WacGroupId ? String(s.WacGroupId) : ""}
                        onChange={(v) => assignGroup(s.Id, v)}
                        placeholder="Unassigned"
                        options={groups.map((g) => ({ label: g.Name, value: String(g.Id) }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Group" : "Add Group"} size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </>
        }
      >
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        <div className="field">
          <label>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Group"
        message={`Delete the "${deleteTarget?.Name}" group? This is only possible when no staff are currently assigned to it and no rules reference it.`}
        confirmLabel="Delete"
        loading={saving}
      />
    </div>
  );
}

export function WacGroupsClient() {
  return (
    <ToastProvider>
      <GroupsInner />
    </ToastProvider>
  );
}
