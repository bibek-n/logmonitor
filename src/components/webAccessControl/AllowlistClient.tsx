"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface AllowlistRow {
  Id: number;
  ServiceName: string;
  Domain: string | null;
  IpAddress: string | null;
  Port: number | null;
  MatchType: "exact" | "suffix";
  IsCritical: boolean;
  Notes: string | null;
  SophosSyncStatus: string | null;
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

const WARNING_TEXT =
  "This is a critical application allowlist entry - removing or changing it may accidentally block a business-critical service for the entire company. Are you sure?";

function emptyForm() {
  return { serviceName: "", domain: "", ipAddress: "", port: "", matchType: "suffix" as "exact" | "suffix", isCritical: true, notes: "" };
}

type PendingAction = { type: "edit-confirm"; row: AllowlistRow } | { type: "delete-confirm"; row: AllowlistRow } | null;

function AllowlistInner() {
  const toast = useToast();
  const [rows, setRows] = useState<AllowlistRow[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AllowlistRow | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/web-access-control/allowlist");
    const data = await res.json();
    if (res.ok && data.ok) setRows(data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  // Editing an EXISTING critical entry requires the warning first; creating a brand new one
  // does not (nothing is being changed/removed yet).
  function openEdit(row: AllowlistRow) {
    setPending({ type: "edit-confirm", row });
  }

  function proceedToEditForm(row: AllowlistRow) {
    setEditing(row);
    setForm({
      serviceName: row.ServiceName,
      domain: row.Domain ?? "",
      ipAddress: row.IpAddress ?? "",
      port: row.Port ? String(row.Port) : "",
      matchType: row.MatchType,
      isCritical: row.IsCritical,
      notes: row.Notes ?? "",
    });
    setPending(null);
    setModalOpen(true);
  }

  async function save() {
    if (!form.serviceName.trim()) {
      toast.show({ type: "error", message: "Service name is required." });
      return;
    }
    if (!form.domain.trim() && !form.ipAddress.trim()) {
      toast.show({ type: "error", message: "Either a domain or an IP address is required." });
      return;
    }
    setSaving(true);
    try {
      const basePayload = {
        serviceName: form.serviceName.trim(),
        domain: form.domain.trim() || null,
        ipAddress: form.ipAddress.trim() || null,
        port: form.port ? Number(form.port) : null,
        matchType: form.matchType,
        isCritical: form.isCritical,
        notes: form.notes.trim() || null,
      };
      const res = await fetch(editing ? `/api/admin/web-access-control/allowlist/${editing.Id}` : "/api/admin/web-access-control/allowlist", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { ...basePayload, acknowledged: true } : basePayload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save allowlist entry.");
      toast.show({ type: "success", message: editing ? "Allowlist entry updated." : "Allowlist entry created." });
      setModalOpen(false);
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save allowlist entry." });
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(row: AllowlistRow) {
    setPending({ type: "delete-confirm", row });
  }

  async function confirmDelete(row: AllowlistRow) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/web-access-control/allowlist/${row.Id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to delete allowlist entry.");
      toast.show({ type: "success", message: "Allowlist entry deleted." });
      setPending(null);
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to delete allowlist entry." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Critical Applications</h2>
          <Button size="sm" onClick={openCreate}>Add Entry</Button>
        </div>
        {rows === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No critical allowlist entries yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Service</th>
                  <th style={{ padding: "0.4rem" }}>Domain</th>
                  <th style={{ padding: "0.4rem" }}>IP</th>
                  <th style={{ padding: "0.4rem" }}>Port</th>
                  <th style={{ padding: "0.4rem" }}>Critical</th>
                  <th style={{ padding: "0.4rem" }}>Sophos</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{row.ServiceName}</td>
                    <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>{row.Domain ?? "-"}</td>
                    <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>{row.IpAddress ?? "-"}</td>
                    <td style={{ padding: "0.4rem" }}>{row.Port ?? "-"}</td>
                    <td style={{ padding: "0.4rem" }}>{row.IsCritical ? <Badge tone="warning">Critical</Badge> : <Badge tone="neutral">No</Badge>}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <Badge tone={row.SophosSyncStatus === "Synced" ? "success" : "neutral"}>{row.SophosSyncStatus ?? "Not Attempted"}</Badge>
                    </td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      <button onClick={() => openEdit(row)} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.8rem", marginRight: "0.6rem" }}>
                        Edit
                      </button>
                      <button onClick={() => requestDelete(row)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.8rem" }}>
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
        title={editing ? "Edit Critical Allowlist Entry" : "Add Critical Allowlist Entry"}
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </>
        }
      >
        <div className="field">
          <label>Service Name</label>
          <input value={form.serviceName} onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))} style={inputStyle} placeholder="e.g. Payroll System" />
        </div>
        <div className="field">
          <label>Domain</label>
          <input value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} style={inputStyle} placeholder="e.g. payroll.example.com" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
          <div className="field">
            <label>IP Address (optional)</label>
            <input value={form.ipAddress} onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))} style={inputStyle} />
          </div>
          <div className="field">
            <label>Port (optional)</label>
            <input value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} style={inputStyle} type="number" />
          </div>
        </div>
        <div className="field">
          <label>Match Type</label>
          <Select value={form.matchType} onChange={(v) => setForm((f) => ({ ...f, matchType: v as "exact" | "suffix" }))} options={[{ label: "Includes subdomains", value: "suffix" }, { label: "Exact domain only", value: "exact" }]} />
        </div>
        <div className="field">
          <label>Notes</label>
          <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={inputStyle} />
        </div>
      </Modal>

      {/* The explicit warning dialog required by the spec before any update or delete of a
          critical allowlist row. */}
      {pending && (
        <Modal
          open
          onClose={() => setPending(null)}
          title="Critical Application Allowlist Warning"
          size="sm"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setPending(null)} disabled={saving}>Cancel</Button>
              <Button
                variant="danger"
                size="sm"
                disabled={saving}
                onClick={() => (pending.type === "edit-confirm" ? proceedToEditForm(pending.row) : confirmDelete(pending.row))}
              >
                {saving ? "Working..." : pending.type === "edit-confirm" ? "Continue to Edit" : "Delete"}
              </Button>
            </>
          }
        >
          <p style={{ color: "var(--warning)", fontWeight: 600, fontSize: "0.9rem", marginTop: 0 }}>Warning</p>
          <p style={{ color: "var(--ink-secondary)", fontSize: "0.88rem", lineHeight: 1.5 }}>{WARNING_TEXT}</p>
          <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>
            Service: <strong>{pending.row.ServiceName}</strong> ({pending.row.Domain ?? pending.row.IpAddress})
          </p>
        </Modal>
      )}
    </div>
  );
}

export function WacAllowlistClient() {
  return (
    <ToastProvider>
      <AllowlistInner />
    </ToastProvider>
  );
}
