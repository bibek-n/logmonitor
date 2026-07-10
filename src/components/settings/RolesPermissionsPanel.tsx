"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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

const PERMISSION_LABEL_KEYS: Record<string, string> = {
  view_dashboard: "viewDashboard",
  manage_endpoint_agents: "manageEndpointAgents",
  manage_router_sophos: "manageRouterSophos",
  manage_website_content: "manageWebsiteContent",
  manage_support_tickets: "manageSupportTickets",
  manage_company_settings: "manageCompanySettings",
};

export function RolesPermissionsPanel({ roles }: { roles: RoleRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("settings.rolesPermissions");
  const [createOpen, setCreateOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", description: "" });
  const [permRole, setPermRole] = useState<RoleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!newRole.name.trim()) {
      toast.show({ type: "error", message: t("roleNameRequiredError") });
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
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("createRoleError"));
      toast.show({ type: "success", message: t("roleCreatedSuccess") });
      setCreateOpen(false);
      setNewRole({ name: "", description: "" });
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("genericError") });
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
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("deleteRoleError"));
      toast.show({ type: "success", message: t("roleDeletedSuccess") });
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("genericError") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3" id="field-roles-permissions">
      <div className="flex items-center justify-between">
        <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>{t("title")}</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> {t("addRole")}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {roles.map((r) => (
          <div key={r.Id} className="flex items-center justify-between rounded-lg p-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <div>
              <div className="flex items-center gap-2">
                <strong style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{r.Name}</strong>
                {r.IsSystem && <Badge tone="info">{t("builtInBadge")}</Badge>}
              </div>
              {r.Description && <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--ink-muted)" }}>{r.Description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPermRole(r)} title={t("managePermissionsTooltip")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)" }}>
                <Settings2 size={15} />
              </button>
              {!r.IsSystem && (
                <button onClick={() => setDeleteTarget(r)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: "0.78rem" }}>
                  {t("deleteButton")}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("addRole")}
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
          <input
            style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.83rem" }}
            placeholder={t("roleNamePlaceholder")}
            value={newRole.name}
            onChange={(e) => setNewRole((r) => ({ ...r, name: e.target.value }))}
          />
          <textarea
            style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.83rem" }}
            rows={2}
            placeholder={t("descriptionPlaceholder")}
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
        title={t("deleteRoleConfirmTitle", { name: deleteTarget?.Name ?? "" })}
        message={t("cannotBeUndoneMessage")}
        confirmLabel={t("deleteButton")}
        tone="danger"
        loading={saving}
      />
    </Card>
  );
}

function PermissionsModal({ role, onClose }: { role: RoleRow; onClose: () => void }) {
  const toast = useToast();
  const t = useTranslations("settings.rolesPermissions");
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
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("savePermissionsError"));
      toast.show({ type: "success", message: t("permissionsSavedSuccess") });
      onClose();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("genericError") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("permissionsModalTitle", { name: role.Name })}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            {t("cancelButton")}
          </Button>
          <Button size="sm" onClick={save} disabled={saving || loading}>
            {saving ? t("savingButton") : t("saveButton")}
          </Button>
        </>
      }
    >
      {loading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>{t("loadingText")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", margin: 0 }}>
            {t("permissionsDisclaimer")}
          </p>
          {permissions.map((p) => (
            <Switch
              key={p.key}
              checked={p.allowed}
              onChange={(v) => setPermissions((prev) => prev.map((x) => (x.key === p.key ? { ...x, allowed: v } : x)))}
              label={PERMISSION_LABEL_KEYS[p.key] ? t(`permissions.${PERMISSION_LABEL_KEYS[p.key]}`) : p.key}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
