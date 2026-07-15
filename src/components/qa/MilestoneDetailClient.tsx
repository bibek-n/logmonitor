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

interface LinkedPlan { Id: number; TestPlanNumber: string; Name: string; Status: string }
interface MilestoneDetail {
  Id: number; ProjectId: number; ReleaseId: number | null; Name: string; MilestoneType: string;
  DueDate: string | null; Status: string; Description: string | null;
  testPlans: LinkedPlan[]; progress: { total: number; completed: number };
}
interface AvailablePlan { Id: number; TestPlanNumber: string; Name: string }

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };
const STATUSES = ["Planned", "In Progress", "Completed", "Missed"];
const TYPES = ["Sprint", "Release Milestone"];
const STATUS_TONE: Record<string, "success" | "info" | "danger" | "neutral"> = {
  Planned: "neutral", "In Progress": "info", Completed: "success", Missed: "danger",
};

function Inner({
  milestone, projectName, availablePlans: initialAvailablePlans, canEdit,
}: {
  milestone: MilestoneDetail;
  projectName: string;
  availablePlans: AvailablePlan[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(milestone.Name);
  const [milestoneType, setMilestoneType] = useState(milestone.MilestoneType);
  const [dueDate, setDueDate] = useState(milestone.DueDate ?? "");
  const [description, setDescription] = useState(milestone.Description ?? "");
  const [status, setStatus] = useState(milestone.Status);
  const [testPlans, setTestPlans] = useState(milestone.testPlans);
  const [availablePlans, setAvailablePlans] = useState(initialAvailablePlans);
  const [linking, setLinking] = useState(false);
  const [selectedToLink, setSelectedToLink] = useState<Set<number>>(new Set());

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/qa/milestones/${milestone.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, milestoneType, dueDate: dueDate || null, description, status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save.");
      toast.show({ type: "success", message: "Milestone updated." });
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  async function linkSelected() {
    const nextIds = [...new Set([...testPlans.map((p) => p.Id), ...selectedToLink])];
    try {
      const res = await fetch(`/api/admin/qa/milestones/${milestone.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testPlanIds: nextIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to link test plans.");
      toast.show({ type: "success", message: "Test plan(s) linked." });
      setLinking(false);
      setSelectedToLink(new Set());
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function unlink(plan: LinkedPlan) {
    const nextIds = testPlans.filter((p) => p.Id !== plan.Id).map((p) => p.Id);
    try {
      const res = await fetch(`/api/admin/qa/milestones/${milestone.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testPlanIds: nextIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to unlink.");
      setTestPlans((prev) => prev.filter((p) => p.Id !== plan.Id));
      setAvailablePlans((prev) => [...prev, { Id: plan.Id, TestPlanNumber: plan.TestPlanNumber, Name: plan.Name }]);
      toast.show({ type: "success", message: "Test plan unlinked." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  const { total, completed } = milestone.progress;

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>{editing ? name : milestone.Name}</h1>
        {!editing && canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</Button>
        )}
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.25rem" }}>{projectName}</p>

      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-2" style={{ flexWrap: "wrap" }}>
          <Badge tone={STATUS_TONE[editing ? status : milestone.Status] ?? "neutral"}>{editing ? status : milestone.Status}</Badge>
          <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>{editing ? milestoneType : milestone.MilestoneType}</span>
          {(editing ? dueDate : milestone.DueDate) && (
            <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Due {editing ? dueDate : milestone.DueDate}</span>
          )}
        </div>
        {editing ? (
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelStyle}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} style={inputStyle} />
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <div>
                <label style={labelStyle}>Type</label>
                <Select value={milestoneType} onChange={setMilestoneType} options={TYPES.map((t) => ({ label: t, value: t }))} />
              </div>
              <div>
                <label style={labelStyle}>Due Date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <Select value={status} onChange={setStatus} options={STATUSES.map((s) => ({ label: s, value: s }))} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
            </div>
          </div>
        ) : (
          <>
            {milestone.Description && <p style={{ fontSize: "0.85rem", color: "var(--ink-secondary)", margin: "0 0 0.5rem" }}>{milestone.Description}</p>}
            <div style={{ fontSize: "0.8rem", color: "var(--ink-secondary)" }}>
              {total > 0 ? `${completed}/${total} linked test plans completed` : "No test plans linked yet."}
            </div>
          </>
        )}
      </Card>

      <Card style={{ padding: 0 }}>
        <div className="flex items-center justify-between" style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "0.95rem", margin: 0 }}>Linked Test Plans ({testPlans.length})</h2>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setLinking(true)}><Plus size={13} /> Link Test Plans</Button>
          )}
        </div>
        {testPlans.length === 0 ? (
          <p style={{ padding: "1rem", color: "var(--ink-muted)", fontSize: "0.85rem" }}>No test plans linked yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Plan", "Name", "Status", ""].map((h) => (
                    <th key={h} style={{ padding: "0.5rem 1rem", color: "var(--ink-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {testPlans.map((p) => (
                  <tr key={p.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem 1rem", fontFamily: "monospace" }}>
                      <Link href={`/dashboard/qa/test-plans/${p.Id}`} style={{ color: "var(--primary)" }}>{p.TestPlanNumber}</Link>
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>{p.Name}</td>
                    <td style={{ padding: "0.5rem 1rem" }}><Badge tone={toneFor(TEST_RUN_STATUS_TONE, p.Status)}>{p.Status}</Badge></td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      {canEdit && (
                        <button onClick={() => unlink(p)} title="Unlink" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
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
        title="Link Test Plans"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setLinking(false)}>Cancel</Button>
            <Button size="sm" onClick={linkSelected} disabled={selectedToLink.size === 0}>Link {selectedToLink.size || ""}</Button>
          </>
        }
      >
        {availablePlans.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No more test plans available to link from this project.</p>
        ) : (
          <div className="flex flex-col gap-1.5" style={{ maxHeight: 360, overflowY: "auto" }}>
            {availablePlans.map((p) => (
              <label key={p.Id} className="flex items-center gap-2" style={{ fontSize: "0.85rem", padding: "0.3rem 0", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedToLink.has(p.Id)}
                  onChange={() => setSelectedToLink((prev) => {
                    const next = new Set(prev);
                    if (next.has(p.Id)) next.delete(p.Id); else next.add(p.Id);
                    return next;
                  })}
                />
                <span style={{ fontFamily: "monospace", color: "var(--ink-muted)" }}>{p.TestPlanNumber}</span> {p.Name}
              </label>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

export function MilestoneDetailClient(props: {
  milestone: MilestoneDetail; projectName: string; availablePlans: AvailablePlan[]; canEdit: boolean;
}) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}
