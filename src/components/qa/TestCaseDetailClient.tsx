"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Copy, Archive, Bug as BugIcon, Paperclip, Upload, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { TestCaseStepsEditor, type StepDraft } from "@/components/qa/TestCaseStepsEditor";
import { TagsEditor } from "@/components/qa/TagsEditor";
import { TEST_CASE_STATUS_TONE, PRIORITY_TONE, EXECUTION_RESULT_TONE, toneFor } from "@/lib/qaBadgeTones";

interface CaseDetail {
  Id: number; ProjectId: number; ModuleId: number | null; TestSuiteId: number; TestCaseNumber: string;
  Title: string; Description: string | null; Preconditions: string | null; ExpectedResult: string | null;
  Priority: string; Severity: string | null; TestType: string; AutomationStatus: string;
  EstimatedMinutes: number | null; Status: string;
  ReviewedByUsername: string | null; ReviewedAt: string | null;
  CreatedAt: string; UpdatedAt: string;
}
interface StepRow { Id: number; StepNumber: number; Action: string; TestData: string | null; ExpectedResult: string | null }
interface HistoryRow { Id: number; Result: string; ActualResult: string | null; Notes: string | null; ExecutedAt: string; ExecutedByUsername: string | null; TestRunNumber: string }
interface AttachmentRow { Id: number; OriginalFileName: string; SizeBytes: number; UploadedAt: string }
interface SuiteOption { Id: number; ProjectId: number; ModuleId: number | null; Name: string }
interface ProjectOption { Id: number; Name: string }
interface RunTypeOption { Id: number; Name: string }

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const TEST_TYPES = ["Functional", "Regression", "Smoke", "Integration", "API", "UI", "Performance", "Security", "User Acceptance"];
const AUTOMATION_STATUSES = ["Manual", "Automated", "To Be Automated"];
const STATUSES = ["Draft", "Ready", "Approved", "Deprecated", "Archived"];

function formatBytes(n: number) {
  return `${(n / 1024).toFixed(1)} KB`;
}

function Inner({
  testCase, steps: initialSteps, tags: initialTags, history, attachments: initialAttachments, suites, projects,
  runTypes, runTypeIds: initialRunTypeIds, canEdit, canDelete, canCreate,
}: {
  testCase: CaseDetail;
  steps: StepRow[];
  tags: string[];
  history: HistoryRow[];
  attachments: AttachmentRow[];
  suites: SuiteOption[];
  projects: ProjectOption[];
  runTypes: RunTypeOption[];
  runTypeIds: number[];
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState(initialAttachments);

  const [testSuiteId, setTestSuiteId] = useState(testCase.TestSuiteId);
  const [title, setTitle] = useState(testCase.Title);
  const [description, setDescription] = useState(testCase.Description ?? "");
  const [preconditions, setPreconditions] = useState(testCase.Preconditions ?? "");
  const [expectedResult, setExpectedResult] = useState(testCase.ExpectedResult ?? "");
  const [priority, setPriority] = useState(testCase.Priority);
  const [severity, setSeverity] = useState(testCase.Severity ?? "");
  const [testType, setTestType] = useState(testCase.TestType);
  const [automationStatus, setAutomationStatus] = useState(testCase.AutomationStatus);
  const [status, setStatus] = useState(testCase.Status);
  const [estimatedMinutes, setEstimatedMinutes] = useState(testCase.EstimatedMinutes != null ? String(testCase.EstimatedMinutes) : "");
  const [tags, setTags] = useState(initialTags);
  const [runTypeIds, setRunTypeIds] = useState<Set<number>>(new Set(initialRunTypeIds));
  const [steps, setSteps] = useState<StepDraft[]>(initialSteps.map((s) => ({ action: s.Action, testData: s.TestData ?? "", expectedResult: s.ExpectedResult ?? "" })));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/qa/test-cases/${testCase.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, preconditions, expectedResult, priority, severity: severity || null,
          testType, automationStatus, status, estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
          tags, runTypeIds: [...runTypeIds],
          steps: steps.map((s, i) => ({ stepNumber: i + 1, action: s.action, testData: s.testData, expectedResult: s.expectedResult })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save.");
      toast.show({ type: "success", message: "Test case updated." });
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  async function clone() {
    try {
      const res = await fetch(`/api/admin/qa/test-cases/${testCase.Id}/clone`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to clone.");
      toast.show({ type: "success", message: `Cloned as ${data.data.TestCaseNumber}.` });
      router.push(`/dashboard/qa/test-cases/${data.data.Id}`);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function setReviewed(reviewed: boolean) {
    try {
      const res = await fetch(`/api/admin/qa/test-cases/${testCase.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save.");
      toast.show({ type: "success", message: reviewed ? "Marked as reviewed." : "Review cleared." });
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function confirmArchive() {
    try {
      const res = await fetch(`/api/admin/qa/test-cases/${testCase.Id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to archive.");
      toast.show({ type: "success", message: "Test case archived." });
      setArchiving(false);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("entityType", "TestCase");
      form.set("entityId", String(testCase.Id));
      form.set("file", file);
      const res = await fetch("/api/admin/qa/attachments", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Upload failed.");
      setAttachments((prev) => [data.data, ...prev]);
      toast.show({ type: "success", message: "Attachment uploaded." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setUploading(false);
    }
  }

  const suite = suites.find((s) => s.Id === testSuiteId);
  const project = projects.find((p) => p.Id === testCase.ProjectId);

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>
          <span style={{ color: "var(--ink-muted)", fontFamily: "monospace", marginRight: 10 }}>{testCase.TestCaseNumber}</span>
          {editing ? title : testCase.Title}
        </h1>
        <div className="flex items-center gap-2">
          {!editing && canCreate && (
            <Link href={`/dashboard/qa/bugs?testCaseId=${testCase.Id}&projectId=${testCase.ProjectId}`}>
              <Button size="sm" variant="secondary"><BugIcon size={13} /> File Bug</Button>
            </Link>
          )}
          {!editing && (
            <Button size="sm" variant="secondary" onClick={clone}><Copy size={13} /> Clone</Button>
          )}
          {!editing && canEdit && !testCase.ReviewedAt && (
            <Button size="sm" variant="secondary" onClick={() => setReviewed(true)}><CheckCircle2 size={13} /> Mark Reviewed</Button>
          )}
          {!editing && canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</Button>
          )}
          {!editing && canDelete && testCase.Status !== "Archived" && (
            <Button size="sm" variant="danger" onClick={() => setArchiving(true)}><Archive size={13} /> Archive</Button>
          )}
        </div>
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.25rem" }}>
        {project?.Name ?? "—"} / {suite?.Name ?? "—"}
      </p>

      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-3" style={{ flexWrap: "wrap" }}>
          <Badge tone={toneFor(TEST_CASE_STATUS_TONE, editing ? status : testCase.Status)}>{editing ? status : testCase.Status}</Badge>
          <Badge tone={toneFor(PRIORITY_TONE, editing ? priority : testCase.Priority)}>{editing ? priority : testCase.Priority}</Badge>
          <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>{testCase.TestType}</span>
          {testCase.ReviewedAt ? (
            <span className="flex items-center gap-1" style={{ fontSize: "0.78rem", color: "var(--success)" }}>
              <CheckCircle2 size={13} /> Reviewed by {testCase.ReviewedByUsername ?? "—"} on {new Date(testCase.ReviewedAt).toLocaleDateString()}
              {!editing && canEdit && (
                <button onClick={() => setReviewed(false)} style={{ background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", fontSize: "0.72rem", textDecoration: "underline", marginLeft: 4 }}>
                  clear
                </button>
              )}
            </span>
          ) : (
            <span style={{ fontSize: "0.78rem", color: "var(--warning)" }}>Not yet reviewed</span>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelStyle}>Test Suite</label>
              <Select value={String(testSuiteId)} onChange={(v) => setTestSuiteId(Number(v))} options={suites.map((s) => ({ label: s.Name, value: String(s.Id) }))} />
            </div>
            <div>
              <label style={labelStyle}>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} style={inputStyle} />
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div>
                <label style={labelStyle}>Preconditions</label>
                <textarea value={preconditions} onChange={(e) => setPreconditions(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Expected Result</label>
              <textarea value={expectedResult} onChange={(e) => setExpectedResult(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <div>
                <label style={labelStyle}>Priority</label>
                <Select value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ label: p, value: p }))} />
              </div>
              <div>
                <label style={labelStyle}>Severity</label>
                <input value={severity} onChange={(e) => setSeverity(e.target.value)} maxLength={20} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Test Type</label>
                <Select value={testType} onChange={setTestType} options={TEST_TYPES.map((t) => ({ label: t, value: t }))} />
              </div>
              <div>
                <label style={labelStyle}>Automation</label>
                <Select value={automationStatus} onChange={setAutomationStatus} options={AUTOMATION_STATUSES.map((t) => ({ label: t, value: t }))} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <Select value={status} onChange={setStatus} options={STATUSES.map((t) => ({ label: t, value: t }))} />
              </div>
              <div>
                <label style={labelStyle}>Estimated Minutes</label>
                <input type="number" min={0} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Tags</label>
              <TagsEditor tags={tags} onChange={setTags} />
            </div>
            <div>
              <label style={labelStyle}>Run Types</label>
              <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", margin: "0 0 0.4rem" }}>
                Which test runs should auto-load this case? A case can belong to more than one.
              </p>
              <div className="flex items-center gap-3" style={{ flexWrap: "wrap" }}>
                {runTypes.map((rt) => (
                  <label key={rt.Id} className="flex items-center gap-1.5" style={{ fontSize: "0.83rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={runTypeIds.has(rt.Id)}
                      onChange={() => setRunTypeIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(rt.Id)) next.delete(rt.Id); else next.add(rt.Id);
                        return next;
                      })}
                    />
                    {rt.Name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {testCase.Description && <p style={{ fontSize: "0.88rem", color: "var(--ink-secondary)", margin: 0 }}>{testCase.Description}</p>}
            {testCase.Preconditions && (
              <div>
                <div style={labelStyle}>Preconditions</div>
                <p style={{ fontSize: "0.85rem", margin: 0 }}>{testCase.Preconditions}</p>
              </div>
            )}
            {testCase.ExpectedResult && (
              <div>
                <div style={labelStyle}>Expected Result</div>
                <p style={{ fontSize: "0.85rem", margin: 0 }}>{testCase.ExpectedResult}</p>
              </div>
            )}
            {tags.length > 0 && (
              <div className="flex items-center gap-1.5" style={{ flexWrap: "wrap" }}>
                {tags.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
              </div>
            )}
            {runTypeIds.size > 0 && (
              <div className="flex items-center gap-1.5" style={{ flexWrap: "wrap" }}>
                {runTypes.filter((rt) => runTypeIds.has(rt.Id)).map((rt) => <Badge key={rt.Id} tone="info">{rt.Name}</Badge>)}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <h2 style={{ fontSize: "0.95rem", marginTop: 0 }}>Steps</h2>
        {editing ? (
          <TestCaseStepsEditor steps={steps} onChange={setSteps} />
        ) : steps.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No steps defined.</p>
        ) : (
          <ol style={{ paddingLeft: "1.25rem", margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {steps.map((s, i) => (
              <li key={i} style={{ fontSize: "0.85rem" }}>
                <strong>{s.action}</strong>
                {s.testData && <div style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>Test data: {s.testData}</div>}
                {s.expectedResult && <div style={{ color: "var(--ink-secondary)", fontSize: "0.78rem" }}>Expected: {s.expectedResult}</div>}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {editing && (
        <div className="flex items-center justify-end gap-2 mb-4">
          <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        </div>
      )}

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 style={{ fontSize: "0.95rem", margin: 0 }}>Attachments</h2>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "var(--primary)", cursor: uploading ? "wait" : "pointer" }}>
            <Upload size={13} /> {uploading ? "Uploading..." : "Upload"}
            <input type="file" style={{ display: "none" }} disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
          </label>
        </div>
        {attachments.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No attachments yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {attachments.map((a) => (
              <a key={a.Id} href={`/api/admin/qa/attachments/${a.Id}`} className="flex items-center gap-2" style={{ fontSize: "0.82rem", color: "var(--primary)" }}>
                <Paperclip size={13} /> {a.OriginalFileName} <span style={{ color: "var(--ink-muted)" }}>({formatBytes(a.SizeBytes)})</span>
              </a>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 style={{ fontSize: "0.95rem", marginTop: 0 }}>Execution History</h2>
        {history.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Never executed.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Run", "Result", "Executed By", "Executed At", "Notes"].map((h) => (
                    <th key={h} style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace" }}>{h.TestRunNumber}</td>
                    <td style={{ padding: "0.4rem 0.6rem" }}><Badge tone={toneFor(EXECUTION_RESULT_TONE, h.Result)}>{h.Result}</Badge></td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>{h.ExecutedByUsername ?? "—"}</td>
                    <td style={{ padding: "0.4rem 0.6rem", whiteSpace: "nowrap" }}>{new Date(h.ExecutedAt).toLocaleString()}</td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>{h.Notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        onConfirm={confirmArchive}
        title={`Archive ${testCase.TestCaseNumber}?`}
        message="Archived test cases are hidden from the default list but not deleted."
        confirmLabel="Archive"
        tone="danger"
      />
    </div>
  );
}

export function TestCaseDetailClient(props: {
  testCase: CaseDetail; steps: StepRow[]; tags: string[]; history: HistoryRow[]; attachments: AttachmentRow[];
  suites: SuiteOption[]; projects: ProjectOption[]; runTypes: RunTypeOption[]; runTypeIds: number[];
  canEdit: boolean; canDelete: boolean; canCreate: boolean;
}) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}
