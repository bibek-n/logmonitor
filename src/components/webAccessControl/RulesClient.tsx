"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { parseJsonResponse } from "@/lib/apiFetch";

interface RuleRow {
  Id: number;
  Domain: string;
  MatchType: "exact" | "suffix";
  Action: "Allow" | "Block";
  ScopeType: "Staff" | "Group" | "Global";
  StaffId: number | null;
  StaffName: string | null;
  StaffWebsiteBlockingEnabled: boolean | null;
  WacGroupId: number | null;
  WacGroupName: string | null;
  ScheduleId: number | null;
  ScheduleName: string | null;
  Priority: "Low" | "Normal" | "High";
  Status: "Enabled" | "Disabled";
  UpdatedAt: string;
  SophosSyncStatus: string | null;
}

interface GroupRow {
  Id: number;
  Name: string;
}
interface StaffRow {
  Id: number;
  Name: string;
  DeviceId: string | null;
  WebsiteBlockingEnabled: boolean | null;
}
interface ScheduleRow {
  Id: number;
  Name: string;
}

interface PreviewResult {
  decision: "Allow" | "Block";
  tier: string;
  matchedRule: unknown;
  conflicts: { id: number; priority: string; action: string }[];
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

function emptyForm() {
  return {
    scopeType: "Group" as "Staff" | "Group" | "Global",
    staffId: "",
    wacGroupId: "",
    domain: "",
    matchType: "suffix" as "exact" | "suffix",
    action: "Block" as "Allow" | "Block",
    scheduleId: "",
    priority: "Normal" as "Low" | "Normal" | "High",
    status: "Enabled" as "Enabled" | "Disabled",
  };
}

function RulesInner() {
  const toast = useToast();
  const [rules, setRules] = useState<RuleRow[] | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RuleRow | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RuleRow | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [enablingBlockingForStaffId, setEnablingBlockingForStaffId] = useState<number | null>(null);

  const [previewDomain, setPreviewDomain] = useState("");
  const [previewStaffId, setPreviewStaffId] = useState("");
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rulesRes, groupsRes, staffRes, schedulesRes] = await Promise.all([
        fetch("/api/admin/web-access-control/rules"),
        fetch("/api/admin/web-access-control/groups"),
        fetch("/api/admin/web-access-control/staff"),
        fetch("/api/admin/web-access-control/schedules"),
      ]);
      const rulesData = await parseJsonResponse(rulesRes);
      const groupsData = await parseJsonResponse(groupsRes);
      const staffData = await parseJsonResponse(staffRes);
      const schedulesData = await parseJsonResponse(schedulesRes);
      if (rulesRes.ok && rulesData.ok) setRules(rulesData.data as RuleRow[]);
      if (groupsRes.ok && groupsData.ok) setGroups(groupsData.data as GroupRow[]);
      if (staffRes.ok && staffData.ok) setStaff(staffData.data as StaffRow[]);
      if (schedulesRes.ok && schedulesData.ok) setSchedules(schedulesData.data as ScheduleRow[]);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to load Web Access Control data." });
    }
    // toast is deliberately excluded - ToastProvider hands out a new context object on every
    // toast it shows, so depending on it here would change load's identity every time this
    // catch block fires, re-triggering the `useEffect(() => { load(); }, [load])` below and
    // looping forever on a persistent failure (e.g. an expired session).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scheduleOptions = useMemo(
    () => [{ label: "Always", value: "" }, ...schedules.map((s) => ({ label: s.Name, value: String(s.Id) }))],
    [schedules]
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(r: RuleRow) {
    setEditing(r);
    setForm({
      scopeType: r.ScopeType,
      staffId: r.StaffId ? String(r.StaffId) : "",
      wacGroupId: r.WacGroupId ? String(r.WacGroupId) : "",
      domain: r.Domain,
      matchType: r.MatchType,
      action: r.Action,
      scheduleId: r.ScheduleId ? String(r.ScheduleId) : "",
      priority: r.Priority,
      status: r.Status,
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.domain.trim()) {
      toast.show({ type: "error", message: "Website (domain) is required." });
      return;
    }
    if (form.scopeType === "Staff" && !form.staffId) {
      toast.show({ type: "error", message: "Select a staff member." });
      return;
    }
    if (form.scopeType === "Group" && !form.wacGroupId) {
      toast.show({ type: "error", message: "Select a group." });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        domain: form.domain.trim(),
        matchType: form.matchType,
        action: form.action,
        scopeType: form.scopeType,
        staffId: form.scopeType === "Staff" ? Number(form.staffId) : null,
        wacGroupId: form.scopeType === "Group" ? Number(form.wacGroupId) : null,
        scheduleId: form.scheduleId ? Number(form.scheduleId) : null,
        priority: form.priority,
        status: form.status,
      };
      const res = await fetch(editing ? `/api/admin/web-access-control/rules/${editing.Id}` : "/api/admin/web-access-control/rules", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save rule.");
      toast.show({ type: "success", message: editing ? "Rule updated." : "Rule created." });
      setModalOpen(false);
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save rule." });
    } finally {
      setSaving(false);
    }
  }

  // Turns on local Website Access Control enforcement for the currently-selected staff
  // member's device - the piece a Staff-scoped rule alone doesn't cover (see the comment on
  // DeviceId/WebsiteBlockingEnabled in /api/admin/web-access-control/staff/route.ts). Lets an
  // admin close that gap without leaving this page/modal to go find the device in Endpoint
  // Agents.
  async function enableBlockingForStaff(deviceId: string, staffId: number) {
    setEnablingBlockingForStaffId(staffId);
    try {
      const res = await fetch(`/api/admin/devices/${deviceId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteBlockingEnabled: true }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to enable website blocking.");
      toast.show({ type: "success", message: "Website blocking enabled for this employee's device." });
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to enable website blocking." });
    } finally {
      setEnablingBlockingForStaffId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/web-access-control/rules/${deleteTarget.Id}`, { method: "DELETE" });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to delete rule.");
      toast.show({ type: "success", message: "Rule deleted." });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to delete rule." });
    } finally {
      setSaving(false);
    }
  }

  async function syncToSophos(ruleId: number) {
    setSyncingId(ruleId);
    try {
      const res = await fetch(`/api/admin/web-access-control/rules/${ruleId}/sync`, { method: "POST" });
      const data = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: { success: boolean; error?: string } };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Sync attempt failed.");
      // Always report the honest result - success is expected to be false today.
      toast.show({
        type: data.data?.success ? "success" : "info",
        message: data.data?.success ? "Synced to Sophos." : `Not synced: ${data.data?.error}`,
      });
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Sync attempt failed." });
    } finally {
      setSyncingId(null);
    }
  }

  async function runPreview() {
    if (!previewDomain.trim() || !previewStaffId) {
      toast.show({ type: "error", message: "Choose a staff member and a domain to check." });
      return;
    }
    setPreviewLoading(true);
    setPreviewResult(null);
    try {
      const res = await fetch("/api/admin/web-access-control/rules/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: previewDomain.trim(), staffId: Number(previewStaffId) }),
      });
      const data = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: PreviewResult };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Preview failed.");
      setPreviewResult(data.data ?? null);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Preview failed." });
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div>
      <Card style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>Check Access (preview before deploying)</h2>
        <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginTop: 0 }}>
          Simulates resolveAccess() against the rules saved right now - shows the decision, which tier matched, and
          any Allow/Block conflict within a staff member&apos;s group before you rely on it.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.6rem", alignItems: "end" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Staff Member</label>
            <Select
              value={previewStaffId}
              onChange={setPreviewStaffId}
              placeholder="Select staff"
              options={staff.map((s) => ({ label: s.Name, value: String(s.Id) }))}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Website</label>
            <input value={previewDomain} onChange={(e) => setPreviewDomain(e.target.value)} style={inputStyle} placeholder="facebook.com" />
          </div>
          <Button size="sm" onClick={runPreview} disabled={previewLoading}>{previewLoading ? "Checking..." : "Check Access"}</Button>
        </div>
        {previewResult && (
          <div style={{ marginTop: "0.85rem", padding: "0.7rem", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.35rem" }}>
              <Badge tone={previewResult.decision === "Allow" ? "success" : "danger"}>{previewResult.decision}</Badge>
              <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Tier: {previewResult.tier}</span>
            </div>
            {previewResult.conflicts.length > 0 && (
              <p style={{ fontSize: "0.8rem", color: "var(--warning)", margin: 0 }}>
                Conflict: {previewResult.conflicts.length} group-level rules disagree for this domain (Allow and
                Block both matched) - resolved deterministically by Priority, then most-recently-updated.
              </p>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Rules</h2>
          <Button size="sm" onClick={openCreate}>Add Rule</Button>
        </div>
        {rules === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : rules.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No rules configured yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Staff/Group</th>
                  <th style={{ padding: "0.4rem" }}>Website</th>
                  <th style={{ padding: "0.4rem" }}>Action</th>
                  <th style={{ padding: "0.4rem" }}>Schedule</th>
                  <th style={{ padding: "0.4rem" }}>Priority</th>
                  <th style={{ padding: "0.4rem" }}>Status</th>
                  <th style={{ padding: "0.4rem" }}>Sophos</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>
                      {r.ScopeType === "Global" ? "All Staff (Global)" : r.ScopeType === "Group" ? r.WacGroupName : r.StaffName}
                      {r.ScopeType === "Staff" && r.Action === "Block" && !r.StaffWebsiteBlockingEnabled && (
                        <span
                          title="Website blocking is not enabled on this employee's device - this rule is not actually enforced yet."
                          style={{ marginLeft: "0.4rem", fontSize: "0.72rem", color: "var(--warning)" }}
                        >
                          ⚠ not enforced
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>
                      {r.MatchType === "suffix" ? `*.${r.Domain}` : r.Domain}
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <Badge tone={r.Action === "Allow" ? "success" : "danger"}>{r.Action.toUpperCase()}</Badge>
                    </td>
                    <td style={{ padding: "0.4rem" }}>{r.ScheduleName ?? "Always"}</td>
                    <td style={{ padding: "0.4rem" }}>{r.Priority}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <Badge tone={r.Status === "Enabled" ? "success" : "neutral"}>{r.Status}</Badge>
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <Badge tone={r.SophosSyncStatus === "Synced" ? "success" : "neutral"}>{r.SophosSyncStatus ?? "Not Attempted"}</Badge>
                    </td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      <button onClick={() => openEdit(r)} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.8rem", marginRight: "0.6rem" }}>
                        Edit
                      </button>
                      <button onClick={() => syncToSophos(r.Id)} disabled={syncingId === r.Id} style={{ background: "none", border: "none", color: "var(--ink-secondary)", cursor: "pointer", fontSize: "0.8rem", marginRight: "0.6rem" }}>
                        {syncingId === r.Id ? "Syncing..." : "Sync to Sophos"}
                      </button>
                      <button onClick={() => setDeleteTarget(r)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.8rem" }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Rule" : "Add Rule"}
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </>
        }
      >
        {/* Field order/labels intentionally match the spec's exact example format. */}
        <div className="field">
          <label>Staff/Group</label>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.5rem" }}>
            <Select
              value={form.scopeType}
              onChange={(v) => setForm((f) => ({ ...f, scopeType: v as typeof f.scopeType, staffId: "", wacGroupId: "" }))}
              options={[
                { label: "Group", value: "Group" },
                { label: "Staff", value: "Staff" },
                { label: "Global (All Staff)", value: "Global" },
              ]}
              style={{ minWidth: 140 }}
            />
            {form.scopeType === "Group" && (
              <Select value={form.wacGroupId} onChange={(v) => setForm((f) => ({ ...f, wacGroupId: v }))} placeholder="Select group" options={groups.map((g) => ({ label: g.Name, value: String(g.Id) }))} />
            )}
            {form.scopeType === "Staff" && (
              <Select value={form.staffId} onChange={(v) => setForm((f) => ({ ...f, staffId: v }))} placeholder="Select staff" options={staff.map((s) => ({ label: s.Name, value: String(s.Id) }))} />
            )}
            {form.scopeType === "Global" && <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)", alignSelf: "center" }}>Applies to all staff</span>}
          </div>
          {form.scopeType === "Staff" && form.staffId && (() => {
            const selectedStaff = staff.find((s) => String(s.Id) === form.staffId);
            if (!selectedStaff) return null;
            if (!selectedStaff.DeviceId) {
              return (
                <p style={{ fontSize: "0.78rem", color: "var(--warning)", margin: "0.4rem 0 0" }}>
                  No endpoint agent device is assigned to this employee yet - a rule for them can be saved now, but
                  there is nothing to enforce it until a device is linked to their Staff record.
                </p>
              );
            }
            if (!selectedStaff.WebsiteBlockingEnabled) {
              return (
                <div style={{ marginTop: "0.4rem", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--warning)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--warning)" }}>
                    Website blocking is not yet enabled on this employee&apos;s device - this rule will save, but
                    won&apos;t actually block anything until it is.
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => enableBlockingForStaff(selectedStaff.DeviceId as string, selectedStaff.Id)}
                    disabled={enablingBlockingForStaffId === selectedStaff.Id}
                  >
                    {enablingBlockingForStaffId === selectedStaff.Id ? "Enabling..." : "Enable Now"}
                  </Button>
                </div>
              );
            }
            return null;
          })()}
        </div>

        <div className="field">
          <label>Website</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.5rem" }}>
            <input value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} style={inputStyle} placeholder="facebook.com" />
            <Select
              value={form.matchType}
              onChange={(v) => setForm((f) => ({ ...f, matchType: v as "exact" | "suffix" }))}
              options={[
                { label: "Includes subdomains", value: "suffix" },
                { label: "Exact domain only", value: "exact" },
              ]}
              style={{ minWidth: 180 }}
            />
          </div>
        </div>

        <div className="field">
          <label>Action</label>
          <Select value={form.action} onChange={(v) => setForm((f) => ({ ...f, action: v as "Allow" | "Block" }))} options={[{ label: "BLOCK", value: "Block" }, { label: "ALLOW", value: "Allow" }]} />
        </div>

        <div className="field">
          <label>Schedule</label>
          <Select value={form.scheduleId} onChange={(v) => setForm((f) => ({ ...f, scheduleId: v }))} options={scheduleOptions} />
        </div>

        <div className="field">
          <label>Priority</label>
          <Select value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v as "Low" | "Normal" | "High" }))} options={[{ label: "Low", value: "Low" }, { label: "Normal", value: "Normal" }, { label: "High", value: "High" }]} />
        </div>

        <div className="field">
          <label>Status</label>
          <Select value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v as "Enabled" | "Disabled" }))} options={[{ label: "Enabled", value: "Enabled" }, { label: "Disabled", value: "Disabled" }]} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Rule"
        message={`Delete the rule for "${deleteTarget?.Domain}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={saving}
      />
    </div>
  );
}

export function WacRulesClient() {
  return (
    <ToastProvider>
      <RulesInner />
    </ToastProvider>
  );
}
