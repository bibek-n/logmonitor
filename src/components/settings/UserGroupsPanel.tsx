"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users as UsersIcon, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

interface GroupRow {
  Id: number;
  Name: string;
  Description: string | null;
  MemberCount: number;
}

interface UserOption {
  label: string;
  value: string;
}

export function UserGroupsPanel({ groups, userOptions }: { groups: GroupRow[]; userOptions: UserOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });
  const [membersGroup, setMembersGroup] = useState<GroupRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupRow | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!newGroup.name.trim()) {
      toast.show({ type: "error", message: "Group name is required." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/user-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGroup),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create group");
      toast.show({ type: "success", message: "User group created." });
      setCreateOpen(false);
      setNewGroup({ name: "", description: "" });
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/settings/user-groups/${deleteTarget.Id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to delete group");
      toast.show({ type: "success", message: "User group deleted." });
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3" id="field-user-groups">
      <div className="flex items-center justify-between">
        <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>User Groups</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Add Group
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {groups.map((g) => (
          <div key={g.Id} className="flex items-center justify-between rounded-lg p-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <div>
              <strong style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{g.Name}</strong>
              <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginLeft: 8 }}>{g.MemberCount} member(s)</span>
              {g.Description && <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--ink-muted)" }}>{g.Description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setMembersGroup(g)} title="Manage members" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)" }}>
                <UsersIcon size={15} />
              </button>
              <button onClick={() => setDeleteTarget(g)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: "0.78rem" }}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {groups.length === 0 && <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No user groups yet.</p>}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add User Group"
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
          <input
            style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.83rem" }}
            placeholder="Group name"
            value={newGroup.name}
            onChange={(e) => setNewGroup((g) => ({ ...g, name: e.target.value }))}
          />
          <textarea
            style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.83rem" }}
            rows={2}
            placeholder="Description (optional)"
            value={newGroup.description}
            onChange={(e) => setNewGroup((g) => ({ ...g, description: e.target.value }))}
          />
        </div>
      </Modal>

      {membersGroup && <MembersModal group={membersGroup} userOptions={userOptions} onClose={() => setMembersGroup(null)} />}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete group "${deleteTarget?.Name}"?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={saving}
      />
    </Card>
  );
}

function MembersModal({ group, userOptions, onClose }: { group: GroupRow; userOptions: UserOption[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [members, setMembers] = useState<{ Id: number; Username: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addUserId, setAddUserId] = useState("");

  function load() {
    fetch(`/api/admin/settings/user-groups/${group.Id}/members`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setMembers(data.data);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.Id]);

  async function addMember() {
    if (!addUserId) return;
    const res = await fetch(`/api/admin/settings/user-groups/${group.Id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: Number(addUserId) }),
    });
    const data = await res.json();
    if (data.ok) {
      setAddUserId("");
      load();
      router.refresh();
    } else {
      toast.show({ type: "error", message: data.error ?? "Failed to add member" });
    }
  }

  async function removeMember(userId: number) {
    const res = await fetch(`/api/admin/settings/user-groups/${group.Id}/members?userId=${userId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      load();
      router.refresh();
    } else {
      toast.show({ type: "error", message: data.error ?? "Failed to remove member" });
    }
  }

  return (
    <Modal open onClose={onClose} title={`Members — ${group.Name}`}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Select value={addUserId} onChange={setAddUserId} options={userOptions} placeholder="Select employee to add" />
          <Button size="sm" onClick={addMember}>
            Add
          </Button>
        </div>
        {loading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Loading...</p>
        ) : (
          <div className="flex flex-col gap-1">
            {members.map((m) => (
              <div key={m.Id} className="flex items-center justify-between" style={{ fontSize: "0.85rem", padding: "0.35rem 0" }}>
                <span>{m.Username}</span>
                <button onClick={() => removeMember(m.Id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                  <X size={14} />
                </button>
              </div>
            ))}
            {members.length === 0 && <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No members yet.</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
