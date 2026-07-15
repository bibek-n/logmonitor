"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RadialProgress } from "@/components/ui/RadialProgress";
import { ProjectSelect, type QaProjectOption } from "@/components/qa/ProjectSelect";
import { PRIORITY_TONE, EXECUTION_RESULT_TONE, toneFor } from "@/lib/qaBadgeTones";

interface MatrixTestCase { Id: number; TestCaseNumber: string; Title: string; LatestResult: string | null }
interface MatrixRow {
  Id: number; RequirementNumber: string; Title: string; Priority: string; Status: string;
  testCases: MatrixTestCase[]; coveragePercent: number;
}

export function TraceabilityMatrixClient({ projects: initialProjects }: { projects: QaProjectOption[] }) {
  const [projects] = useState(initialProjects);
  const [projectId, setProjectId] = useState<number | null>(initialProjects[0]?.Id ?? null);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/qa/requirements/traceability?projectId=${projectId}`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled && data.ok) setMatrix(data.data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const overallCoverage = matrix.length > 0 ? Math.round(matrix.reduce((sum, r) => sum + r.coveragePercent, 0) / matrix.length) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-3" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ width: 220 }}>
          <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} onProjectCreated={() => {}} />
        </div>
        {matrix.length > 0 && (
          <div className="flex items-center gap-2">
            <RadialProgress percent={overallCoverage} size={36} />
            <span style={{ fontSize: "0.82rem", color: "var(--ink-secondary)" }}>{overallCoverage}% average requirement coverage</span>
          </div>
        )}
      </div>

      <Card style={{ padding: 0 }}>
        {loading ? (
          <p style={{ padding: "1rem", color: "var(--ink-muted)", fontSize: "0.85rem" }}>Loading...</p>
        ) : matrix.length === 0 ? (
          <p style={{ padding: "1rem", color: "var(--ink-muted)", fontSize: "0.85rem" }}>No requirements for this project yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Requirement", "Priority", "Status", "Linked Test Cases", "Coverage"].map((h) => (
                    <th key={h} style={{ padding: "0.5rem 1rem", color: "var(--ink-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((r) => (
                  <tr key={r.Id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <Link href={`/dashboard/qa/requirements/${r.Id}`} style={{ color: "var(--primary)", fontFamily: "monospace" }}>{r.RequirementNumber}</Link>
                      <div style={{ fontSize: "0.82rem", color: "var(--ink-secondary)" }}>{r.Title}</div>
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}><Badge tone={toneFor(PRIORITY_TONE, r.Priority)}>{r.Priority}</Badge></td>
                    <td style={{ padding: "0.5rem 1rem" }}>{r.Status}</td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      {r.testCases.length === 0 ? (
                        <span style={{ color: "var(--ink-muted)" }}>None linked</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {r.testCases.map((tc) => (
                            <div key={tc.Id} className="flex items-center gap-2">
                              <Link href={`/dashboard/qa/test-cases/${tc.Id}`} style={{ color: "var(--primary)", fontFamily: "monospace", fontSize: "0.78rem" }}>{tc.TestCaseNumber}</Link>
                              <Badge tone={toneFor(EXECUTION_RESULT_TONE, tc.LatestResult ?? "Not Run")}>{tc.LatestResult ?? "Not Run"}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>
                      <Badge tone={r.coveragePercent === 100 ? "success" : r.coveragePercent > 0 ? "warning" : "neutral"}>{r.coveragePercent}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
