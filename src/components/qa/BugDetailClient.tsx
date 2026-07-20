"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Paperclip, Upload, RotateCcw, Zap, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { BUG_STATUS_TONE, PRIORITY_TONE, toneFor } from "@/lib/qaBadgeTones";

interface BugDetail {
  Id: number; BugNumber: string; Title: string; Description: string | null; ProjectId: number;
  TestCaseId: number | null; TestRunId: number | null; StepsToReproduce: string | null;
  ExpectedResult: string | null; ActualResult: string | null; Severity: string; Priority: string;
  Status: string; AssignedDeveloperUserId: number | null; Environment: string | null; Browser: string | null;
  Device: string | null; AppVersion: string | null; CreatedAt: string; UpdatedAt: string; ResolvedAt: string | null;
}
interface UserOption { Id: number; Username: string }
interface AttachmentRow { Id: number; OriginalFileName: string; SizeBytes: number; UploadedAt: string }

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };
const STATUSES = ["New", "Open", "In Progress", "Resolved", "Ready for Retest", "Verified", "Closed", "Rejected", "Duplicate", "Reopened"];
const SEVERITIES = ["Low", "Medium", "High", "Critical"];

function formatBytes(n: number) {
  return `${(n / 1024).toFixed(1)} KB`;
}

function Inner({
  bug, users, testCase, reporterUsername, attachments: initialAttachments,
  retestRunCaseId, retestLatestResult, retestLatestAt, canEdit,
}: {
  bug: BugDetail;
  users: UserOption[];
  testCase: { TestCaseNumber: string; Title: string } | null;
  reporterUsername: string | null;
  attachments: AttachmentRow[];
  retestRunCaseId: number | null;
  retestLatestResult: string | null;
  retestLatestAt: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [transitioning, setTransitioning] = useState(false);

  const [title, setTitle] = useState(bug.Title);
  const [description, setDescription] = useState(bug.Description ?? "");
  const [stepsToReproduce, setStepsToReproduce] = useState(bug.StepsToReproduce ?? "");
  const [expectedResult, setExpectedResult] = useState(bug.ExpectedResult ?? "");
  const [actualResult, setActualResult] = useState(bug.ActualResult ?? "");
  const [severity, setSeverity] = useState(bug.Severity);
  const [priority, setPriority] = useState(bug.Priority);
  const [status, setStatus] = useState(bug.Status);
  const [assignedDeveloperUserId, setAssignedDeveloperUserId] = useState<number | null>(bug.AssignedDeveloperUserId);

  // Retest loop: Resolved -> (tester clicks "Ready for Retest") -> "Retest Now" re-executes
  // the exact same test case in the same run it was originally filed from -> that execution's
  // result (if it happened after ResolvedAt, i.e. actually against the fix) decides whether
  // "Verify Fix" or "Reopen" is the next available action.
  const retestedSinceResolved = !!(retestLatestAt && bug.ResolvedAt && new Date(retestLatestAt) > new Date(bug.ResolvedAt));
  const canMarkReadyForRetest = canEdit && status === "Resolved";
  const canRetestNow = status === "Ready for Retest" && !!retestRunCaseId;
  const canVerify = canEdit && status === "Ready for Retest" && retestedSinceResolved && retestLatestResult === "Passed";
  const canReopen = canEdit && status === "Ready for Retest" && retestedSinceResolved && retestLatestResult === "Failed";

  async function transitionStatus(next: string, message: string) {
    setTransitioning(true);
    try {
      await saveField({ status: next }, message);
      setStatus(next);
    } finally {
      setTransitioning(false);
    }
  }

  async function saveField(patch: Record<string, unknown>, successMessage: string) {
    try {
      const res = await fetch(`/api/admin/qa/bugs/${bug.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save.");
      toast.show({ type: "success", message: successMessage });
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function save() {
    setSaving(true);
    try {
      await saveField({ title, description, stepsToReproduce, expectedResult, actualResult, severity, priority, status, assignedDeveloperUserId }, "Bug updated.");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("entityType", "Bug");
      form.set("entityId", String(bug.Id));
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

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>
          <span style={{ color: "var(--ink-muted)", fontFamily: "monospace", marginRight: 10 }}>{bug.BugNumber}</span>
          {editing ? title : bug.Title}
        </h1>
        {!editing && (
          <div className="flex items-center gap-2">
            {canMarkReadyForRetest && (
              <Button size="sm" variant="secondary" disabled={transitioning} onClick={() => transitionStatus("Ready for Retest", "Marked ready for retest.")}>
                <RotateCcw size={13} /> Ready for Retest
              </Button>
            )}
            {canRetestNow && (
              <Link href={`/dashboard/qa/execute/${retestRunCaseId}`}>
                <Button size="sm" variant="secondary"><Zap size={13} /> Retest Now</Button>
              </Link>
            )}
            {canVerify && (
              <Button size="sm" disabled={transitioning} onClick={() => transitionStatus("Verified", "Fix verified.")}>
                <CheckCircle2 size={13} /> Verify Fix
              </Button>
            )}
            {canReopen && (
              <Button size="sm" variant="danger" disabled={transitioning} onClick={() => transitionStatus("Reopened", "Bug reopened — retest failed again.")}>
                <AlertTriangle size={13} /> Reopen
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</Button>
            )}
          </div>
        )}
      </div>
      {status === "Ready for Retest" && retestRunCaseId && (
        <p style={{ fontSize: "0.78rem", color: retestedSinceResolved ? (retestLatestResult === "Passed" ? "var(--success)" : "var(--danger)") : "var(--ink-muted)", marginTop: 0, marginBottom: "0.5rem" }}>
          {retestedSinceResolved
            ? `Retested since the fix: ${retestLatestResult} on ${retestLatestAt ? new Date(retestLatestAt).toLocaleString() : ""}.`
            : "Not yet retested since the fix — click \"Retest Now\" to re-execute the original test case."}
        </p>
      )}
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.25rem" }}>
        Filed by {reporterUsername ?? "—"} on {new Date(bug.CreatedAt).toLocaleDateString()}
        {testCase && (
          <> · from <Link href={`/dashboard/qa/test-cases/${bug.TestCaseId}`} style={{ color: "var(--primary)" }}>{testCase.TestCaseNumber}</Link></>
        )}
      </p>

      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-3" style={{ flexWrap: "wrap" }}>
          <Badge tone={toneFor(BUG_STATUS_TONE, editing ? status : bug.Status)}>{editing ? status : bug.Status}</Badge>
          <Badge tone={toneFor(PRIORITY_TONE, editing ? severity : bug.Severity)}>{editing ? severity : bug.Severity} severity</Badge>
          <Badge tone={toneFor(PRIORITY_TONE, editing ? priority : bug.Priority)}>{editing ? priority : bug.Priority} priority</Badge>
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
            <div>
              <label style={labelStyle}>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label style={labelStyle}>Steps to Reproduce</label>
              <textarea value={stepsToReproduce} onChange={(e) => setStepsToReproduce(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div>
                <label style={labelStyle}>Expected Result</label>
                <textarea value={expectedResult} onChange={(e) => setExpectedResult(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div>
                <label style={labelStyle}>Actual Result</label>
                <textarea value={actualResult} onChange={(e) => setActualResult(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <div>
                <label style={labelStyle}>Severity</label>
                <Select value={severity} onChange={setSeverity} options={SEVERITIES.map((s) => ({ label: s, value: s }))} />
              </div>
              <div>
                <label style={labelStyle}>Priority</label>
                <Select value={priority} onChange={setPriority} options={SEVERITIES.map((s) => ({ label: s, value: s }))} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <Select value={status} onChange={setStatus} options={STATUSES.map((s) => ({ label: s, value: s }))} />
              </div>
              <div>
                <label style={labelStyle}>Assigned Developer</label>
                <Select value={assignedDeveloperUserId ? String(assignedDeveloperUserId) : ""} onChange={(v) => setAssignedDeveloperUserId(v ? Number(v) : null)} placeholder="Unassigned" options={users.map((u) => ({ label: u.Username, value: String(u.Id) }))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {bug.Description && <p style={{ fontSize: "0.88rem", color: "var(--ink-secondary)", margin: 0 }}>{bug.Description}</p>}
            {bug.StepsToReproduce && (
              <div>
                <div style={labelStyle}>Steps to Reproduce</div>
                <p style={{ fontSize: "0.85rem", margin: 0, whiteSpace: "pre-wrap" }}>{bug.StepsToReproduce}</p>
              </div>
            )}
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {bug.ExpectedResult && (
                <div>
                  <div style={labelStyle}>Expected Result</div>
                  <p style={{ fontSize: "0.85rem", margin: 0 }}>{bug.ExpectedResult}</p>
                </div>
              )}
              {bug.ActualResult && (
                <div>
                  <div style={labelStyle}>Actual Result</div>
                  <p style={{ fontSize: "0.85rem", margin: 0 }}>{bug.ActualResult}</p>
                </div>
              )}
            </div>
            <div>
              <div style={labelStyle}>Assigned Developer</div>
              <p style={{ fontSize: "0.85rem", margin: 0 }}>{users.find((u) => u.Id === bug.AssignedDeveloperUserId)?.Username ?? "Unassigned"}</p>
            </div>
          </div>
        )}
      </Card>

      <Card>
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
    </div>
  );
}

export function BugDetailClient(props: {
  bug: BugDetail; users: UserOption[]; testCase: { TestCaseNumber: string; Title: string } | null;
  reporterUsername: string | null; attachments: AttachmentRow[];
  retestRunCaseId: number | null; retestLatestResult: string | null; retestLatestAt: string | null;
  canEdit: boolean;
}) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}
