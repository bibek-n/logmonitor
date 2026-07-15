"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X, Zap, Rocket, ShieldCheck, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { TEST_RUN_STATUS_TONE, EXECUTION_RESULT_TONE, PRIORITY_TONE, toneFor } from "@/lib/qaBadgeTones";

interface RunDetail {
  Id: number; TestRunNumber: string; Name: string; Description: string | null; ProjectId: number;
  ReleaseId: number | null; Environment: string | null; Browser: string | null; OperatingSystem: string | null;
  Device: string | null; StartDate: string | null; EndDate: string | null; Status: string;
  RunTypeId: number | null; RunTypeName: string | null;
  DeployedBuildVersion: string | null; DeployedAt: string | null;
  QaApprovedByUserId: number | null; QaApprovedAt: string | null; CreatedAt: string;
}
interface RunCaseRow {
  Id: number; TestCaseId: number; AssignedUserId: number | null; TestCaseNumber: string; Title: string;
  Priority: string; LatestResult: string | null; LatestExecutedAt: string | null;
  BugId: number | null; BugNumber: string | null; BugStatus: string | null;
}
interface UserOption { Id: number; Username: string }
interface AvailableCase { Id: number; TestCaseNumber: string; Title: string }

interface StepState {
  label: string;
  done: boolean;
  detail?: string;
}

// The workflow's own stage indicator: Requirement/Suite/Cases/Review/Run-creation already
// happened before this page exists at all — this stepper covers the remainder of the
// pipeline (Deploy through Release) in one glance, since those steps otherwise live scattered
// across this page's own sections and the linked Release page.
function WorkflowStepper({ steps }: { steps: StepState[] }) {
  return (
    <div className="flex items-center" style={{ flexWrap: "wrap", gap: "0.4rem", marginBottom: "1.25rem" }}>
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center" style={{ gap: "0.4rem" }}>
          <div
            className="flex items-center gap-1.5"
            style={{
              padding: "0.3rem 0.65rem", borderRadius: 999, fontSize: "0.76rem",
              border: `1px solid ${step.done ? "var(--success)" : "var(--border)"}`,
              background: step.done ? "color-mix(in srgb, var(--success) 12%, transparent)" : "var(--surface-2)",
              color: step.done ? "var(--success)" : "var(--ink-muted)",
            }}
            title={step.detail}
          >
            {step.done ? <Check size={12} /> : <span style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid currentColor", display: "inline-block" }} />}
            {step.label}
          </div>
          {i < steps.length - 1 && <span style={{ color: "var(--border)" }}>→</span>}
        </div>
      ))}
    </div>
  );
}

const STATUS_FLOW: Record<string, string[]> = {
  Planned: ["In Progress", "Cancelled"],
  "In Progress": ["Paused", "Completed", "Cancelled"],
  Paused: ["In Progress", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

function Inner({
  run, projectName, runCases: initialRunCases, users, availableCases: initialAvailableCases,
  blockingBugCount, qaApprovedByUsername, releaseName, releaseStatus, canManage, canExecute,
}: {
  run: RunDetail;
  projectName: string;
  runCases: RunCaseRow[];
  users: UserOption[];
  availableCases: AvailableCase[];
  blockingBugCount: number;
  qaApprovedByUsername: string | null;
  releaseName: string | null;
  releaseStatus: string | null;
  canManage: boolean;
  canExecute: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState(run.Status);
  const [runCases, setRunCases] = useState(initialRunCases);
  const [availableCases, setAvailableCases] = useState(initialAvailableCases);
  const [addingCases, setAddingCases] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<number>>(new Set());
  const [statusChanging, setStatusChanging] = useState(false);
  const [deployedBuildVersion, setDeployedBuildVersion] = useState(run.DeployedBuildVersion ?? "");
  const [deployedAt, setDeployedAt] = useState(run.DeployedAt);
  const [deploying, setDeploying] = useState(false);
  const [qaApprovedAt, setQaApprovedAt] = useState(run.QaApprovedAt);
  const [approving, setApproving] = useState(false);

  const passed = runCases.filter((c) => c.LatestResult === "Passed").length;
  const total = runCases.length;
  const executedCount = runCases.filter((c) => !!c.LatestResult).length;
  const canApprove = status === "Completed" && blockingBugCount === 0 && !qaApprovedAt;

  const isRegressionRun = run.RunTypeName === "Regression Test";
  const workflowSteps: StepState[] = [
    { label: "Run Created", done: true },
    { label: "Deployed to QA", done: !!deployedAt, detail: deployedAt ? `Build ${deployedBuildVersion}` : "Not yet deployed" },
    { label: "Executed", done: total > 0 && executedCount === total, detail: `${executedCount}/${total} cases executed` },
    ...(isRegressionRun ? [{ label: "Regression Pass", done: status === "Completed", detail: run.RunTypeName ?? undefined } as StepState] : []),
    { label: "QA Approved", done: !!qaApprovedAt, detail: blockingBugCount > 0 ? `${blockingBugCount} blocking bug(s)` : undefined },
    ...(run.ReleaseId
      ? [{ label: "Released", done: releaseStatus === "Released", detail: releaseName ?? undefined } as StepState]
      : []),
  ];

  async function deployToQa() {
    if (!deployedBuildVersion.trim()) return toast.show({ type: "error", message: "Enter a build version first." });
    setDeploying(true);
    try {
      const res = await fetch(`/api/admin/qa/test-runs/${run.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deployedBuildVersion }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to record deployment.");
      setDeployedAt(new Date().toISOString());
      toast.show({ type: "success", message: `Build ${deployedBuildVersion} recorded as deployed to QA.` });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setDeploying(false);
    }
  }

  async function approveQa() {
    setApproving(true);
    try {
      const res = await fetch(`/api/admin/qa/test-runs/${run.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qaApproved: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to approve.");
      setQaApprovedAt(new Date().toISOString());
      toast.show({ type: "success", message: "Run QA-approved." });
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setApproving(false);
    }
  }

  async function changeStatus(next: string) {
    setStatusChanging(true);
    try {
      const res = await fetch(`/api/admin/qa/test-runs/${run.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to update status.");
      setStatus(next);
      toast.show({ type: "success", message: `Run status set to ${next}.` });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setStatusChanging(false);
    }
  }

  async function addSelectedCases() {
    const testCaseIds = [...selectedToAdd];
    if (testCaseIds.length === 0) return;
    try {
      const res = await fetch(`/api/admin/qa/test-runs/${run.Id}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCaseIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to add cases.");
      toast.show({ type: "success", message: `Added ${data.data.added} test case(s).` });
      setAvailableCases((prev) => prev.filter((c) => !testCaseIds.includes(c.Id)));
      setSelectedToAdd(new Set());
      setAddingCases(false);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function removeCase(rc: RunCaseRow) {
    try {
      const res = await fetch(`/api/admin/qa/test-runs/${run.Id}/cases/${rc.Id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to remove.");
      setRunCases((prev) => prev.filter((c) => c.Id !== rc.Id));
      setAvailableCases((prev) => [...prev, { Id: rc.TestCaseId, TestCaseNumber: rc.TestCaseNumber, Title: rc.Title }]);
      toast.show({ type: "success", message: "Test case removed from run." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function reassign(rc: RunCaseRow, userId: number | null) {
    try {
      const res = await fetch(`/api/admin/qa/test-runs/${run.Id}/cases/${rc.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedUserId: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to reassign.");
      setRunCases((prev) => prev.map((c) => (c.Id === rc.Id ? { ...c, AssignedUserId: userId } : c)));
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>
          <span style={{ color: "var(--ink-muted)", fontFamily: "monospace", marginRight: 10 }}>{run.TestRunNumber}</span>
          {run.Name}
        </h1>
        <div className="flex items-center gap-2">
          {canManage && (STATUS_FLOW[status] ?? []).map((next) => (
            <Button key={next} size="sm" variant={next === "Cancelled" ? "danger" : "secondary"} disabled={statusChanging} onClick={() => changeStatus(next)}>
              {next}
            </Button>
          ))}
          {canManage && !qaApprovedAt && (
            <Button
              size="sm"
              onClick={approveQa}
              disabled={!canApprove || approving}
              title={
                status !== "Completed" ? "The run must be Completed first."
                  : blockingBugCount > 0 ? `${blockingBugCount} open Critical/High bug(s) still block approval.`
                  : undefined
              }
            >
              <ShieldCheck size={13} /> {approving ? "Approving..." : "QA Approve"}
            </Button>
          )}
        </div>
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "0.75rem" }}>{projectName}</p>

      <WorkflowStepper steps={workflowSteps} />

      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-2" style={{ flexWrap: "wrap" }}>
          <Badge tone={toneFor(TEST_RUN_STATUS_TONE, status)}>{status}</Badge>
          {run.RunTypeName && <Badge tone={isRegressionRun ? "info" : "neutral"}>{run.RunTypeName}</Badge>}
          {qaApprovedAt && <Badge tone="success">QA Approved{qaApprovedByUsername ? ` by ${qaApprovedByUsername}` : ""}</Badge>}
          {run.Environment && <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Env: {run.Environment}</span>}
          {run.Browser && <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Browser: {run.Browser}</span>}
          {run.OperatingSystem && <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>OS: {run.OperatingSystem}</span>}
          {run.ReleaseId && (
            <Link href={`/dashboard/qa/releases/${run.ReleaseId}`} style={{ fontSize: "0.78rem", color: "var(--primary)" }}>
              Release: {releaseName ?? "—"} ({releaseStatus}) →
            </Link>
          )}
        </div>
        {run.Description && <p style={{ fontSize: "0.85rem", color: "var(--ink-secondary)", margin: "0 0 0.5rem" }}>{run.Description}</p>}
        <div style={{ fontSize: "0.8rem", color: "var(--ink-secondary)" }}>
          {total > 0 ? `${passed}/${total} passed (${Math.round((passed / total) * 100)}%)` : "No test cases assigned yet."}
          {blockingBugCount > 0 && (
            <span style={{ color: "var(--danger)", marginLeft: 10 }}>
              · {blockingBugCount} open Critical/High bug{blockingBugCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </Card>

      <Card className="mb-4">
        <h2 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.75rem" }}>Deploy Application to QA</h2>
        {deployedAt ? (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-secondary)", margin: "0 0 0.75rem" }}>
            Build <strong style={{ fontFamily: "monospace" }}>{deployedBuildVersion}</strong> deployed on {new Date(deployedAt).toLocaleString()}.
          </p>
        ) : (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: "0 0 0.75rem" }}>Not yet recorded as deployed to QA.</p>
        )}
        {canManage && (
          <div className="flex items-center gap-2">
            <input
              value={deployedBuildVersion}
              onChange={(e) => setDeployedBuildVersion(e.target.value)}
              maxLength={50}
              placeholder="Build version, e.g. v1.4.2 or commit sha"
              style={{ flex: 1, maxWidth: 260, padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" }}
            />
            <Button size="sm" variant="secondary" onClick={deployToQa} disabled={deploying}>
              <Rocket size={13} /> {deploying ? "Recording..." : deployedAt ? "Re-deploy" : "Deploy to QA"}
            </Button>
          </div>
        )}
      </Card>

      <Card style={{ padding: 0 }}>
        <div className="flex items-center justify-between" style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "0.95rem", margin: 0 }}>Test Cases ({runCases.length})</h2>
          {canManage && (
            <Button size="sm" variant="secondary" onClick={() => setAddingCases(true)}>
              <Plus size={13} /> Add Test Cases
            </Button>
          )}
        </div>
        {runCases.length === 0 ? (
          <p style={{ padding: "1rem", color: "var(--ink-muted)", fontSize: "0.85rem" }}>No test cases added yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Number", "Title", "Priority", "Assigned To", "Latest Result", "Bug", ""].map((h) => (
                    <th key={h} style={{ padding: "0.5rem 1rem", color: "var(--ink-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runCases.map((rc) => (
                  <tr key={rc.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem 1rem", fontFamily: "monospace" }}>
                      <Link href={`/dashboard/qa/test-cases/${rc.TestCaseId}`} style={{ color: "var(--primary)" }}>{rc.TestCaseNumber}</Link>
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>{rc.Title}</td>
                    <td style={{ padding: "0.5rem 1rem" }}><Badge tone={toneFor(PRIORITY_TONE, rc.Priority)}>{rc.Priority}</Badge></td>
                    <td style={{ padding: "0.5rem 1rem", minWidth: 160 }}>
                      {canManage ? (
                        <Select
                          value={rc.AssignedUserId ? String(rc.AssignedUserId) : ""}
                          onChange={(v) => reassign(rc, v ? Number(v) : null)}
                          placeholder="Unassigned"
                          options={users.map((u) => ({ label: u.Username, value: String(u.Id) }))}
                        />
                      ) : (
                        users.find((u) => u.Id === rc.AssignedUserId)?.Username ?? "Unassigned"
                      )}
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <Badge tone={toneFor(EXECUTION_RESULT_TONE, rc.LatestResult ?? "Not Run")}>{rc.LatestResult ?? "Not Run"}</Badge>
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      {rc.BugId ? (
                        <Link href={`/dashboard/qa/bugs/${rc.BugId}`} style={{ color: "var(--primary)", fontFamily: "monospace", fontSize: "0.8rem" }}>
                          {rc.BugNumber}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--ink-muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem 1rem", whiteSpace: "nowrap" }}>
                      <div className="flex items-center gap-2">
                        {canExecute && (
                          <Link
                            href={`/dashboard/qa/execute/${rc.Id}`}
                            title={rc.LatestResult === "Failed" ? "Retest" : "Execute"}
                            style={{ color: "var(--primary)", display: "flex" }}
                          >
                            <Zap size={14} />
                          </Link>
                        )}
                        {canManage && (
                          <button onClick={() => removeCase(rc)} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={addingCases}
        onClose={() => setAddingCases(false)}
        title="Add Test Cases to Run"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAddingCases(false)}>Cancel</Button>
            <Button size="sm" onClick={addSelectedCases} disabled={selectedToAdd.size === 0}>Add {selectedToAdd.size || ""}</Button>
          </>
        }
      >
        {availableCases.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No more test cases available to add from this project.</p>
        ) : (
          <div className="flex flex-col gap-1.5" style={{ maxHeight: 360, overflowY: "auto" }}>
            {availableCases.map((c) => (
              <label key={c.Id} className="flex items-center gap-2" style={{ fontSize: "0.85rem", padding: "0.3rem 0", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedToAdd.has(c.Id)}
                  onChange={() => setSelectedToAdd((prev) => {
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

export function TestRunDetailClient(props: {
  run: RunDetail; projectName: string; runCases: RunCaseRow[]; users: UserOption[]; availableCases: AvailableCase[];
  blockingBugCount: number; qaApprovedByUsername: string | null; releaseName: string | null; releaseStatus: string | null;
  canManage: boolean; canExecute: boolean;
}) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}
