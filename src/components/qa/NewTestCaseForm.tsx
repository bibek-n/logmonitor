"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ProjectSelect, type QaProjectOption } from "@/components/qa/ProjectSelect";
import { TestCaseStepsEditor, type StepDraft } from "@/components/qa/TestCaseStepsEditor";
import { TagsEditor } from "@/components/qa/TagsEditor";

interface QaSuiteOption {
  Id: number;
  ProjectId: number;
  ModuleId: number | null;
  Name: string;
}

interface QaRunTypeOption {
  Id: number;
  Name: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)",
};
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };

const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const TEST_TYPES = ["Functional", "Regression", "Smoke", "Integration", "API", "UI", "Performance", "Security", "User Acceptance"];
const AUTOMATION_STATUSES = ["Manual", "Automated", "To Be Automated"];

function NewTestCaseFormInner({ projects, suites, runTypes, initialTestSuiteId }: { projects: QaProjectOption[]; suites: QaSuiteOption[]; runTypes: QaRunTypeOption[]; initialTestSuiteId: number | null }) {
  const router = useRouter();
  const toast = useToast();

  const initialSuite = suites.find((s) => s.Id === initialTestSuiteId) ?? null;
  const [projectId, setProjectId] = useState<number | null>(initialSuite?.ProjectId ?? null);
  const [testSuiteId, setTestSuiteId] = useState<number | null>(initialTestSuiteId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preconditions, setPreconditions] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [severity, setSeverity] = useState("");
  const [testType, setTestType] = useState("Functional");
  const [automationStatus, setAutomationStatus] = useState("Manual");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [runTypeIds, setRunTypeIds] = useState<Set<number>>(new Set());
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [projectList, setProjectList] = useState(projects);

  const suitesForProject = projectId ? suites.filter((s) => s.ProjectId === projectId) : [];

  async function submit() {
    if (!testSuiteId) return toast.show({ type: "error", message: "Select a test suite." });
    if (!title.trim()) return toast.show({ type: "error", message: "Title is required." });
    if (steps.some((s) => !s.action.trim())) return toast.show({ type: "error", message: "Every step needs an action, or remove the empty one." });

    setSaving(true);
    try {
      const res = await fetch("/api/admin/qa/test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, testSuiteId, title, description, preconditions, expectedResult, priority,
          severity: severity || undefined, testType, automationStatus,
          estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
          tags, runTypeIds: [...runTypeIds],
          steps: steps.map((s, i) => ({ stepNumber: i + 1, action: s.action, testData: s.testData, expectedResult: s.expectedResult })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create test case.");
      toast.show({ type: "success", message: `Test case ${data.data.TestCaseNumber} created.` });
      router.push(`/dashboard/qa/test-cases/${data.data.Id}`);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 900 }}>
      <Card>
        <h2 style={{ fontSize: "0.95rem", marginTop: 0 }}>Details</h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div>
            <label style={labelStyle}>Project</label>
            <ProjectSelect
              projects={projectList}
              value={projectId}
              onChange={(id) => { setProjectId(id); setTestSuiteId(null); }}
              onProjectCreated={(p) => setProjectList((prev) => [...prev, p])}
            />
          </div>
          <div>
            <label style={labelStyle}>Test Suite</label>
            <Select value={testSuiteId ? String(testSuiteId) : ""} onChange={(v) => setTestSuiteId(v ? Number(v) : null)} placeholder={projectId ? "Select a suite" : "Select a project first"} options={suitesForProject.map((s) => ({ label: s.Name, value: String(s.Id) }))} />
          </div>
        </div>
        <div style={{ marginTop: "0.75rem" }}>
          <label style={labelStyle}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} style={inputStyle} />
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: "0.75rem" }}>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <label style={labelStyle}>Preconditions</label>
            <textarea value={preconditions} onChange={(e) => setPreconditions(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        </div>
        <div style={{ marginTop: "0.75rem" }}>
          <label style={labelStyle}>Expected Result</label>
          <textarea value={expectedResult} onChange={(e) => setExpectedResult(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div>
            <label style={labelStyle}>Priority</label>
            <Select value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ label: p, value: p }))} />
          </div>
          <div>
            <label style={labelStyle}>Severity</label>
            <input value={severity} onChange={(e) => setSeverity(e.target.value)} maxLength={20} style={inputStyle} placeholder="Optional" />
          </div>
          <div>
            <label style={labelStyle}>Test Type</label>
            <Select value={testType} onChange={setTestType} options={TEST_TYPES.map((t) => ({ label: t, value: t }))} />
          </div>
          <div>
            <label style={labelStyle}>Automation Status</label>
            <Select value={automationStatus} onChange={setAutomationStatus} options={AUTOMATION_STATUSES.map((t) => ({ label: t, value: t }))} />
          </div>
          <div>
            <label style={labelStyle}>Estimated Minutes</label>
            <input type="number" min={0} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginTop: "0.75rem" }}>
          <label style={labelStyle}>Tags</label>
          <TagsEditor tags={tags} onChange={setTags} />
        </div>
        <div style={{ marginTop: "0.75rem" }}>
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
      </Card>

      <Card>
        <h2 style={{ fontSize: "0.95rem", marginTop: 0 }}>Steps</h2>
        <TestCaseStepsEditor steps={steps} onChange={setSteps} />
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={() => router.back()} disabled={saving}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? "Creating..." : "Create Test Case"}</Button>
      </div>
    </div>
  );
}

export function NewTestCaseForm(props: { projects: QaProjectOption[]; suites: QaSuiteOption[]; runTypes: QaRunTypeOption[]; initialTestSuiteId: number | null }) {
  return (
    <ToastProvider>
      <NewTestCaseFormInner {...props} />
    </ToastProvider>
  );
}
