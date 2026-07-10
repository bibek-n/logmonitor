"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Settings2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

interface RoleRow {
  Id: number;
  Name: string;
  Description: string | null;
  IsSystem: boolean;
}

const PERMISSION_LABELS: Record<string, string> = {
  view_dashboard: "View Dashboard",
  manage_endpoint_agents: "Manage Endpoint Agents",
  manage_router_sophos: "Manage Router & Sophos Tools",
  manage_website_content: "Manage Website Content",
  manage_support_tickets: "Manage Support Tickets",
  manage_company_settings: "Manage Company Settings",
};

export function RolesPermissionsPanel({ roles }: { roles: RoleRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", description: "" });
  const [permRole, setPermRole] = useState<RoleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!newRole.name.trim()) {
      toast.show({ type: "error", message: "Role name is required." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRole),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create role");
      toast.show({ type: "success", message: "Role created." });
      setCreateOpen(false);
      setNewRole({ name: "", description: "" });
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
      const res = await fetch(`/api/admin/settings/roles/${deleteTarget.Id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to delete role");
      toast.show({ type: "success", message: "Role deleted." });
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3" id="field-roles-permissions">
      <div className="flex items-center justify-between">
        <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>Roles and Permissions</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Add Role
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {roles.map((r) => (
          <div key={r.Id} className="flex items-center justify-between rounded-lg p-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <div>
              <div className="flex items-center gap-2">
                <strong style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{r.Name}</strong>
                {r.IsSystem && <Badge tone="info">Built-in</Badge>}
              </div>
              {r.Description && <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--ink-muted)" }}>{r.Description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPermRole(r)} title="Manage permissions" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)" }}>
                <Settings2 size={15} />
              </button>
              {!r.IsSystem && (
                <button onClick={() => setDeleteTarget(r)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: "0.78rem" }}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Role"
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
            placeholder="Role name"
            value={newRole.name}
            onChange={(e) => setNewRole((r) => ({ ...r, name: e.target.value }))}
          />
          <textarea
            style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.83rem" }}
            rows={2}
            placeholder="Description (optional)"
            value={newRole.description}
            onChange={(e) => setNewRole((r) => ({ ...r, description: e.target.value }))}
          />
        </div>
      </Modal>

      {permRole && <PermissionsModal role={permRole} onClose={() => setPermRole(null)} />}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete role "${deleteTarget?.Name}"?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={saving}
      />
    </Card>
  );
}

function PermissionsModal({ role, onClose }: { role: RoleRow; onClose: () => void }) {
  const toast = useToast();
  const [permissions, setPermissions] = useState<{ key: string; allowed: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/settings/roles/${role.Id}/permissions`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setPermissions(data.data);
      })
      .finally(() => setLoading(false));
  }, [role.Id]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/settings/roles/${role.Id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save permissions");
      toast.show({ type: "success", message: "Permissions saved." });
      onClose();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Permissions — ${role.Name}`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving || loading}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      {loading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Loading...</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", margin: 0 }}>
            These permissions are recorded for reference. Enforcement across the rest of the app is a future phase.
          </p>
          {permissions.map((p) => (
            <Switch
              key={p.key}
              checked={p.allowed}
              onChange={(v) => setPermissions((prev) => prev.map((x) => (x.key === p.key ? { ...x, allowed: v } : x)))}
              label={PERMISSION_LABELS[p.key] ?? p.key}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
