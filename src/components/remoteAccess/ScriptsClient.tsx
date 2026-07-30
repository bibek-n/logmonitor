"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface Script {
  id: number;
  name: string;
  description: string | null;
  scriptType: string;
  body: string;
  targetOsFamily: string | null;
}
interface Connection {
  id: number;
  name: string;
  protocol: string;
}
interface ExecutionResult {
  connectionId: number;
  status: "Completed" | "Failed";
  exitCode: number | null;
  errorMessage: string | null;
}
interface ApprovalRequest {
  id: number;
  summary: string;
  requestedByUsername: string;
  createdAt: string;
}

const SCRIPT_TYPES = ["Shell", "PowerShell", "Python", "Batch", "Command"];
const inputStyle = { padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem", width: "100%" };
const labelStyle = { display: "block", fontSize: "0.78rem", marginBottom: 4, color: "var(--ink-muted)" };

function ScriptsInner() {
  const toast = useToast();
  const [scripts, setScripts] = useState<Script[] | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", scriptType: "Shell", body: "", targetOsFamily: "" });

  const [runTarget, setRunTarget] = useState<Script | null>(null);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<number[]>([]);
  const [runBusy, setRunBusy] = useState(false);
  const [runResults, setRunResults] = useState<ExecutionResult[] | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/remote-access/scripts");
    const data = await res.json();
    if (res.ok && data.ok) setScripts(data.data);
  }, []);

  const loadApprovals = useCallback(async () => {
    const res = await fetch("/api/admin/remote-access/approvals?status=Pending");
    const data = await res.json();
    if (res.ok && data.ok) setApprovals(data.data);
  }, []);

  useEffect(() => {
    load();
    loadApprovals();
    (async () => {
      const res = await fetch("/api/admin/remote-access/connections");
      const data = await res.json();
      if (res.ok && data.ok) setConnections(data.data.filter((c: Connection) => c.protocol === "SSH"));
    })();
  }, [load, loadApprovals]);

  async function approveRequest(approval: ApprovalRequest) {
    const res = await fetch(`/api/admin/remote-access/approvals/${approval.id}/approve`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to approve." });
      return;
    }
    toast.show({ type: "success", message: "Approved and executed." });
    await loadApprovals();
  }

  async function rejectRequest(approval: ApprovalRequest) {
    if (!confirm(`Reject "${approval.summary}"?`)) return;
    await fetch(`/api/admin/remote-access/approvals/${approval.id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    await loadApprovals();
  }

  async function createScript() {
    if (!form.name.trim() || !form.body.trim()) {
      toast.show({ type: "error", message: "Name and script body are required." });
      return;
    }
    const res = await fetch("/api/admin/remote-access/scripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, description: form.description || null, scriptType: form.scriptType, body: form.body, targetOsFamily: form.targetOsFamily || null }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to save script." });
      return;
    }
    setFormOpen(false);
    setForm({ name: "", description: "", scriptType: "Shell", body: "", targetOsFamily: "" });
    await load();
  }

  async function removeScript(script: Script) {
    if (!confirm(`Delete script "${script.name}"?`)) return;
    await fetch(`/api/admin/remote-access/scripts/${script.id}`, { method: "DELETE" });
    await load();
  }

  function openRun(script: Script) {
    setRunTarget(script);
    setSelectedConnectionIds([]);
    setRunResults(null);
  }

  function toggleConnection(id: number) {
    setSelectedConnectionIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function execute() {
    if (!runTarget || selectedConnectionIds.length === 0) return;
    const isBulk = selectedConnectionIds.length > 1;
    if (isBulk && !confirm(`Run "${runTarget.name}" on ${selectedConnectionIds.length} connections? This executes the script on every selected target.`)) return;

    setRunBusy(true);
    const res = await fetch(`/api/admin/remote-access/scripts/${runTarget.id}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionIds: selectedConnectionIds, confirm: isBulk }),
    });
    const data = await res.json();
    setRunBusy(false);
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Execution failed." });
      return;
    }
    if (data.data.pendingApprovalId) {
      toast.show({ type: "success", message: "This bulk run exceeds the approval threshold - it's queued and needs another admin's approval before it executes." });
      setRunTarget(null);
      await loadApprovals();
      return;
    }
    setRunResults(data.data.results);
  }

  return (
    <div>
      {approvals.length > 0 && (
        <Card style={{ marginBottom: "1rem", borderColor: "var(--warning)" }}>
          <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Pending Bulk-Execution Approvals</h3>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {approvals.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
                <span>
                  {a.summary} <span style={{ color: "var(--ink-muted)" }}>— requested by {a.requestedByUsername}</span>
                </span>
                <div style={{ display: "flex", gap: "0.3rem" }}>
                  <Button size="sm" onClick={() => approveRequest(a)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => rejectRequest(a)}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <Button onClick={() => setFormOpen(true)}>New Script</Button>
      </div>

      <div className="dash-panel">
        {scripts === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : scripts.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No saved scripts yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ padding: "0.4rem" }}>Name</th>
                <th style={{ padding: "0.4rem" }}>Type</th>
                <th style={{ padding: "0.4rem" }}>Target OS</th>
                <th style={{ padding: "0.4rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {scripts.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>
                    {s.name}
                    {s.description && <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>{s.description}</div>}
                  </td>
                  <td style={{ padding: "0.4rem" }}>
                    <Badge tone="neutral">{s.scriptType}</Badge>
                  </td>
                  <td style={{ padding: "0.4rem" }}>{s.targetOsFamily ?? "Any"}</td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                    <Button size="sm" onClick={() => openRun(s)}>
                      Run
                    </Button>{" "}
                    <Button size="sm" variant="danger" onClick={() => removeScript(s)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="New Script" size="lg" footer={<Button onClick={createScript}>Save</Button>}>
        <div style={{ display: "grid", gap: "0.7rem" }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <input style={inputStyle} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: "0.7rem" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={form.scriptType} onChange={(e) => setForm({ ...form, scriptType: e.target.value })}>
                {SCRIPT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Target OS</label>
              <select style={inputStyle} value={form.targetOsFamily} onChange={(e) => setForm({ ...form, targetOsFamily: e.target.value })}>
                <option value="">Any</option>
                <option value="Linux">Linux</option>
                <option value="Windows">Windows</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Script Body</label>
            <textarea style={{ ...inputStyle, minHeight: 160, fontFamily: "monospace", fontSize: "0.8rem" }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal open={!!runTarget} onClose={() => setRunTarget(null)} title={`Run — ${runTarget?.name ?? ""}`} size="md" footer={<Button onClick={execute} disabled={runBusy || selectedConnectionIds.length === 0}>{runBusy ? "Running..." : "Execute"}</Button>}>
        {runResults === null ? (
          <div>
            <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>Select one or more SSH connections to run this script on.</p>
            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem" }}>
              {connections.length === 0 ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No SSH connections available.</p>
              ) : (
                connections.map((c) => (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.25rem 0", fontSize: "0.85rem" }}>
                    <input type="checkbox" checked={selectedConnectionIds.includes(c.id)} onChange={() => toggleConnection(c.id)} />
                    {c.name}
                  </label>
                ))
              )}
            </div>
            {selectedConnectionIds.length > 1 && (
              <p style={{ fontSize: "0.78rem", color: "var(--warning)", marginTop: "0.5rem" }}>
                Bulk execution: this will run on all {selectedConnectionIds.length} selected connections and requires confirmation.
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {runResults.map((r) => {
              const conn = connections.find((c) => c.id === r.connectionId);
              return (
                <div key={r.connectionId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
                  <span>{conn?.name ?? `Connection #${r.connectionId}`}</span>
                  <Badge tone={r.status === "Completed" ? "success" : "danger"}>{r.status === "Completed" ? `Exit ${r.exitCode}` : r.errorMessage ?? "Failed"}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}

export function ScriptsClient() {
  return (
    <ToastProvider>
      <ScriptsInner />
    </ToastProvider>
  );
}
