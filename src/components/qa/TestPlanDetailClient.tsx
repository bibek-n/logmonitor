"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { TEST_RUN_STATUS_TONE, toneFor } from "@/lib/qaBadgeTones";

interface LinkedRun { Id: number; TestRunNumber: string; Name: string; Status: string; Total: number; Passed: number; Executed: number }
interface TestPlanDetail {
  Id: number; TestPlanNumber: string; ProjectId: number; ReleaseId: number | null; Name: string;
  Description: string | null; Status: string; runs: LinkedRun[]; progress: { total: number; passed: number; executed: number };
}
interface AvailableRun { Id: number; TestRunNumber: string; Name: string }

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };
const STATUSES = ["Planned", "In Progress", "Paused", "Completed", "Cancelled"];

function Inner({
  testPlan, projectName, availableRuns: initialAvailableRuns, canEdit,
}: {
  testPlan: TestPlanDetail;
  projectName: string;
  availableRuns: AvailableRun[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(testPlan.Name);
  const [description, setDescription] = useState(testPlan.Description ?? "");
  const [status, setStatus] = useState(testPlan.Status);
  const [runs, setRuns] = useState(testPlan.runs);
  const [availableRuns, setAvailableRuns] = useState(initialAvailableRuns);
  const [linking, setLinking] = useState(false);
  const [selectedToLink, setSelectedToLink] = useState<Set<number>>(new Set());

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/qa/test-plans/${testPlan.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save.");
      toast.show({ type: "success", message: "Test plan updated." });
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  async function linkSelected() {
    const nextIds = [...new Set([...runs.map((r) => r.Id), ...selectedToLink])];
    try {
      const res = await fetch(`/api/admin/qa/test-plans/${testPlan.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testRunIds: nextIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to link runs.");
      toast.show({ type: "success", message: "Test run(s) linked." });
      setLinking(false);
      setSelectedToLink(new Set());
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function unlink(run: LinkedRun) {
    const nextIds = runs.filter((r) => r.Id !== run.Id).map((r) => r.Id);
    try {
      const res = await fetch(`/api/admin/qa/test-plans/${testPlan.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testRunIds: nextIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to unlink.");
      setRuns((prev) => prev.filter((r) => r.Id !== run.Id));
      setAvailableRuns((prev) => [...prev, { Id: run.Id, TestRunNumber: run.TestRunNumber, Name: run.Name }]);
      toast.show({ type: "success", message: "Test run unlinked." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  const { total, passed, executed } = testPlan.progress;

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>
          <span style={{ color: "var(--ink-muted)", fontFamily: "monospace", marginRight: 10 }}>{testPlan.TestPlanNumber}</span>
          {editing ? name : testPlan.Name}
        </h1>
        {!editing && canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</Button>
        )}
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.25rem" }}>{projectName}</p>

      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-2" style={{ flexWrap: "wrap" }}>
          <Badge tone={toneFor(TEST_RUN_STATUS_TONE, editing ? status : testPlan.Status)}>{editing ? status : testPlan.Status}</Badge>
        </div>
        {editing ? (
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelStyle}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <Select value={status} onChange={setStatus} options={STATUSES.map((s) => ({ label: s, value: s }))} />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
            </div>
          </div>
        ) : (
          <>
            {testPlan.Description && <p style={{ fontSize: "0.85rem", color: "var(--ink-secondary)", margin: "0 0 0.5rem" }}>{testPlan.Description}</p>}
            <div style={{ fontSize: "0.8rem", color: "var(--ink-secondary)" }}>
              {total > 0
                ? `${passed}/${total} passed across all linked runs (${Math.round((passed / total) * 100)}%) · ${executed}/${total} executed`
                : "No test cases in any linked run yet."}
            </div>
          </>
        )}
      </Card>

      <Card style={{ padding: 0 }}>
        <div className="flex items-center justify-between" style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "0.95rem", margin: 0 }}>Linked Test Runs ({runs.length})</h2>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setLinking(true)}><Plus size={13} /> Link Test Runs</Button>
          )}
        </div>
        {runs.length === 0 ? (
          <p style={{ padding: "1rem", color: "var(--ink-muted)", fontSize: "0.85rem" }}>No test runs linked yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Run", "Name", "Status", "Progress", ""].map((h) => (
                    <th key={h} style={{ padding: "0.5rem 1rem", color: "var(--ink-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem 1rem", fontFamily: "monospace" }}>
                      <Link href={`/dashboard/qa/test-runs/${r.Id}`} style={{ color: "var(--primary)" }}>{r.TestRunNumber}</Link>
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>{r.Name}</td>
                    <td style={{ padding: "0.5rem 1rem" }}><Badge tone={toneFor(TEST_RUN_STATUS_TONE, r.Status)}>{r.Status}</Badge></td>
                    <td style={{ padding: "0.5rem 1rem" }}>{r.Total > 0 ? `${r.Passed}/${r.Total} passed` : "No cases"}</td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      {canEdit && (
                        <button onClick={() => unlink(r)} title="Unlink" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                          <X size={14} />
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

      <Modal
        open={linking}
        onClose={() => setLinking(false)}
        title="Link Test Runs"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setLinking(false)}>Cancel</Button>
            <Button size="sm" onClick={linkSelected} disabled={selectedToLink.size === 0}>Link {selectedToLink.size || ""}</Button>
          </>
        }
      >
        {availableRuns.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No more test runs available to link from this project.</p>
        ) : (
          <div className="flex flex-col gap-1.5" style={{ maxHeight: 360, overflowY: "auto" }}>
            {availableRuns.map((r) => (
              <label key={r.Id} className="flex items-center gap-2" style={{ fontSize: "0.85rem", padding: "0.3rem 0", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedToLink.has(r.Id)}
                  onChange={() => setSelectedToLink((prev) => {
                    const next = new Set(prev);
                    if (next.has(r.Id)) next.delete(r.Id); else next.add(r.Id);
                    return next;
                  })}
                />
                <span style={{ fontFamily: "monospace", color: "var(--ink-muted)" }}>{r.TestRunNumber}</span> {r.Name}
              </label>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

export function TestPlanDetailClient(props: {
  testPlan: TestPlanDetail; projectName: string; availableRuns: AvailableRun[]; canEdit: boolean;
}) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}
