"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bug as BugIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { EXECUTION_RESULT_TONE, PRIORITY_TONE, toneFor } from "@/lib/qaBadgeTones";

interface RunCaseInfo {
  RunCaseId: number; TestRunId: number; TestRunNumber: string; TestCaseId: number; ProjectId: number;
  TestCaseNumber: string; Title: string; Description: string | null; Preconditions: string | null;
  ExpectedResult: string | null; Priority: string;
}
interface StepRow { StepNumber: number; Action: string; TestData: string | null; ExpectedResult: string | null }
interface HistoryRow { Id: number; Result: string; Notes: string | null; ExecutedAt: string; ExecutedByUsername: string | null }

const RESULTS = ["Passed", "Failed", "Blocked", "Skipped"];
const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };
const labelStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 };

function Inner({ info, steps, history }: { info: RunCaseInfo; steps: StepRow[]; history: HistoryRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [result, setResult] = useState<string | null>(null);
  const [actualResult, setActualResult] = useState("");
  const [notes, setNotes] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  async function submit() {
    if (!result) return toast.show({ type: "error", message: "Choose a result first." });
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/qa/test-runs/${info.TestRunId}/cases/${info.RunCaseId}/executions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result, actualResult, notes,
          durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to submit result.");
      toast.show({ type: "success", message: `Result recorded: ${result}.` });
      setSubmitted(result);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>
          <span style={{ color: "var(--ink-muted)", fontFamily: "monospace", marginRight: 10 }}>{info.TestCaseNumber}</span>
          {info.Title}
        </h1>
        <Badge tone={toneFor(PRIORITY_TONE, info.Priority)}>{info.Priority}</Badge>
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.25rem" }}>{info.TestRunNumber}</p>

      <Card className="mb-4">
        {info.Preconditions && (
          <div className="mb-2">
            <div style={labelStyle}>Preconditions</div>
            <p style={{ fontSize: "0.85rem", margin: 0 }}>{info.Preconditions}</p>
          </div>
        )}
        {steps.length > 0 ? (
          <>
            <div style={labelStyle}>Steps</div>
            <ol style={{ paddingLeft: "1.25rem", margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {steps.map((s) => (
                <li key={s.StepNumber} style={{ fontSize: "0.85rem" }}>
                  <strong>{s.Action}</strong>
                  {s.TestData && <div style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>Test data: {s.TestData}</div>}
                  {s.ExpectedResult && <div style={{ color: "var(--ink-secondary)", fontSize: "0.78rem" }}>Expected: {s.ExpectedResult}</div>}
                </li>
              ))}
            </ol>
          </>
        ) : (
          info.ExpectedResult && (
            <div>
              <div style={labelStyle}>Expected Result</div>
              <p style={{ fontSize: "0.85rem", margin: 0 }}>{info.ExpectedResult}</p>
            </div>
          )
        )}
      </Card>

      <Card className="mb-4">
        <h2 style={{ fontSize: "0.95rem", marginTop: 0 }}>Submit Result</h2>
        <div className="flex items-center gap-2 mb-3" style={{ flexWrap: "wrap" }}>
          {RESULTS.map((r) => (
            <Button key={r} type="button" size="sm" variant={result === r ? "primary" : "secondary"} onClick={() => setResult(r)}>
              {r}
            </Button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label style={labelStyle}>Actual Result</label>
            <textarea value={actualResult} onChange={(e) => setActualResult(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ maxWidth: 200 }}>
            <label style={labelStyle}>Duration (minutes)</label>
            <input type="number" min={0} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div className="flex items-center justify-between" style={{ marginTop: "1rem" }}>
          {(submitted === "Failed" || result === "Failed") && (
            <Link href={`/dashboard/qa/bugs?testCaseId=${info.TestCaseId}&projectId=${info.ProjectId}&testRunId=${info.TestRunId}`}>
              <Button type="button" variant="secondary" size="sm"><BugIcon size={13} /> File Bug from this Failure</Button>
            </Link>
          )}
          <Button onClick={submit} disabled={submitting} style={{ marginLeft: "auto" }}>{submitting ? "Submitting..." : "Submit Result"}</Button>
        </div>
      </Card>

      <Card>
        <h2 style={{ fontSize: "0.95rem", marginTop: 0 }}>Previous Executions</h2>
        {history.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No previous executions.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <div key={h.Id} className="flex items-center justify-between" style={{ padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: "0.82rem" }}>{h.ExecutedByUsername ?? "—"} · {new Date(h.ExecutedAt).toLocaleString()}</span>
                <Badge tone={toneFor(EXECUTION_RESULT_TONE, h.Result)}>{h.Result}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function ExecuteTestClient(props: { info: RunCaseInfo; steps: StepRow[]; history: HistoryRow[] }) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}
