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
import { PRIORITY_TONE, EXECUTION_RESULT_TONE, toneFor } from "@/lib/qaBadgeTones";

interface LinkedCase { Id: number; TestCaseNumber: string; Title: string; LatestResult: string | null }
interface RequirementDetail {
  Id: number; RequirementNumber: string; ProjectId: number; Title: string; Description: string | null;
  Category: string | null; Priority: string; Status: string; testCases: LinkedCase[];
}
interface AvailableCase { Id: number; TestCaseNumber: string; Title: string }

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const STATUSES = ["New", "Approved", "Implemented", "Verified", "Deprecated"];
const REQUIREMENT_STATUS_TONE: Record<string, "success" | "info" | "warning" | "neutral"> = {
  New: "neutral", Approved: "info", Implemented: "warning", Verified: "success", Deprecated: "neutral",
};

function Inner({
  requirement, projectName, availableCases: initialAvailableCases, canEdit,
}: {
  requirement: RequirementDetail;
  projectName: string;
  availableCases: AvailableCase[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(requirement.Title);
  const [description, setDescription] = useState(requirement.Description ?? "");
  const [category, setCategory] = useState(requirement.Category ?? "");
  const [priority, setPriority] = useState(requirement.Priority);
  const [status, setStatus] = useState(requirement.Status);
  const [testCases, setTestCases] = useState(requirement.testCases);
  const [availableCases, setAvailableCases] = useState(initialAvailableCases);
  const [linking, setLinking] = useState(false);
  const [selectedToLink, setSelectedToLink] = useState<Set<number>>(new Set());

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/qa/requirements/${requirement.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, priority, status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save.");
      toast.show({ type: "success", message: "Requirement updated." });
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  async function linkSelected() {
    const nextIds = [...new Set([...testCases.map((c) => c.Id), ...selectedToLink])];
    try {
      const res = await fetch(`/api/admin/qa/requirements/${requirement.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCaseIds: nextIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to link test cases.");
      const linked = availableCases.filter((c) => selectedToLink.has(c.Id));
      setTestCases((prev) => [...prev, ...linked.map((c) => ({ ...c, LatestResult: null }))]);
      setAvailableCases((prev) => prev.filter((c) => !selectedToLink.has(c.Id)));
      setSelectedToLink(new Set());
      setLinking(false);
      toast.show({ type: "success", message: `Linked ${linked.length} test case(s).` });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function unlink(testCase: LinkedCase) {
    const nextIds = testCases.filter((c) => c.Id !== testCase.Id).map((c) => c.Id);
    try {
      const res = await fetch(`/api/admin/qa/requirements/${requirement.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCaseIds: nextIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to unlink.");
      setTestCases((prev) => prev.filter((c) => c.Id !== testCase.Id));
      setAvailableCases((prev) => [...prev, { Id: testCase.Id, TestCaseNumber: testCase.TestCaseNumber, Title: testCase.Title }]);
      toast.show({ type: "success", message: "Test case unlinked." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  const passed = testCases.filter((c) => c.LatestResult === "Passed").length;

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>
          <span style={{ color: "var(--ink-muted)", fontFamily: "monospace", marginRight: 10 }}>{requirement.RequirementNumber}</span>
          {editing ? title : requirement.Title}
        </h1>
        {!editing && canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</Button>
        )}
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.25rem" }}>{projectName}</p>

      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-3" style={{ flexWrap: "wrap" }}>
          <Badge tone={REQUIREMENT_STATUS_TONE[editing ? status : requirement.Status] ?? "neutral"}>{editing ? status : requirement.Status}</Badge>
          <Badge tone={toneFor(PRIORITY_TONE, editing ? priority : requirement.Priority)}>{editing ? priority : requirement.Priority}</Badge>
          {(editing ? category : requirement.Category) && (
            <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>{editing ? category : requirement.Category}</span>
          )}
          {testCases.length > 0 && (
            <span style={{ fontSize: "0.8rem", color: "var(--ink-secondary)" }}>
              {passed}/{testCases.length} covered test cases passing
            </span>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelStyle}>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <div>
                <label style={labelStyle}>Category</label>
                <input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={50} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Priority</label>
                <Select value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ label: p, value: p }))} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <Select value={status} onChange={setStatus} options={STATUSES.map((s) => ({ label: s, value: s }))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
            </div>
          </div>
        ) : (
          requirement.Description && <p style={{ fontSize: "0.88rem", color: "var(--ink-secondary)", margin: 0 }}>{requirement.Description}</p>
        )}
      </Card>

      <Card style={{ padding: 0 }}>
        <div className="flex items-center justify-between" style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "0.95rem", margin: 0 }}>Linked Test Cases ({testCases.length})</h2>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setLinking(true)}><Plus size={13} /> Link Test Cases</Button>
          )}
        </div>
        {testCases.length === 0 ? (
          <p style={{ padding: "1rem", color: "var(--ink-muted)", fontSize: "0.85rem" }}>No test cases linked yet — coverage is 0%.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Number", "Title", "Latest Result", ""].map((h) => (
                    <th key={h} style={{ padding: "0.5rem 1rem", color: "var(--ink-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {testCases.map((c) => (
                  <tr key={c.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem 1rem", fontFamily: "monospace" }}>
                      <Link href={`/dashboard/qa/test-cases/${c.Id}`} style={{ color: "var(--primary)" }}>{c.TestCaseNumber}</Link>
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>{c.Title}</td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <Badge tone={toneFor(EXECUTION_RESULT_TONE, c.LatestResult ?? "Not Run")}>{c.LatestResult ?? "Not Run"}</Badge>
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      {canEdit && (
                        <button onClick={() => unlink(c)} title="Unlink" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
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
        title="Link Test Cases"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setLinking(false)}>Cancel</Button>
            <Button size="sm" onClick={linkSelected} disabled={selectedToLink.size === 0}>Link {selectedToLink.size || ""}</Button>
          </>
        }
      >
        {availableCases.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No more test cases available to link from this project.</p>
        ) : (
          <div className="flex flex-col gap-1.5" style={{ maxHeight: 360, overflowY: "auto" }}>
            {availableCases.map((c) => (
              <label key={c.Id} className="flex items-center gap-2" style={{ fontSize: "0.85rem", padding: "0.3rem 0", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedToLink.has(c.Id)}
                  onChange={() => setSelectedToLink((prev) => {
                    const next = new Set(prev);
                    if (next.has(c.Id)) next.delete(c.Id); else next.add(c.Id);
                    return next;
                  })}
                />
                <span style={{ fontFamily: "monospace", color: "var(--ink-muted)" }}>{c.TestCaseNumber}</span> {c.Title}
              </label>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

export function RequirementDetailClient(props: {
  requirement: RequirementDetail; projectName: string; availableCases: AvailableCase[]; canEdit: boolean;
}) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}
