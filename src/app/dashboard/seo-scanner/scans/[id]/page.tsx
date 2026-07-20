import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { Badge } from "@/components/ui/Badge";
import type { CheckSummary, ScanFinding, Severity } from "@/lib/seoScanner/shared";

export const dynamic = "force-dynamic";

interface ScanRow {
  Id: number;
  WebsiteId: number | null;
  WebsiteName: string | null;
  TargetUrl: string;
  Score: number;
  Grade: string;
  FindingsJson: string;
  ChecksJson: string;
  TriggeredByUsername: string | null;
  ScannedAt: string;
}

function gradeTone(grade: string): "success" | "warning" | "danger" {
  if (grade === "A" || grade === "B") return "success";
  if (grade === "C") return "warning";
  return "danger";
}

function severityTone(severity: Severity): "success" | "warning" | "danger" | "info" | "neutral" {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  if (severity === "low") return "info";
  return "neutral";
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export default async function SeoScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>SEO Scan Report</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view SEO Scanner results.</p>
      </div>
    );
  }

  const { id } = await params;
  const scanId = Number(id);
  if (!Number.isInteger(scanId) || scanId <= 0) notFound();

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, scanId).query<ScanRow>(`
    SELECT s.Id, s.WebsiteId, w.Name AS WebsiteName, s.TargetUrl, s.Score, s.Grade, s.FindingsJson, s.ChecksJson,
      s.TriggeredByUsername, CONVERT(VARCHAR(19), s.ScannedAt, 126) AS ScannedAt
    FROM SeoScans s
    LEFT JOIN Websites w ON w.Id = s.WebsiteId
    WHERE s.Id = @id
  `);
  const row = result.recordset[0];
  if (!row) notFound();

  const findings: ScanFinding[] = JSON.parse(row.FindingsJson);
  const checks: CheckSummary[] = JSON.parse(row.ChecksJson);
  const sortedFindings = [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const gradeColorVar = `var(--${gradeTone(row.Grade)})`;

  return (
    <div>
      <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        <Link href="/dashboard/seo-scanner" style={{ color: "var(--primary)" }}>
          ← Back to SEO Scanner
        </Link>
      </p>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>{row.WebsiteName ?? row.TargetUrl}</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        {row.TargetUrl} · Scanned {row.ScannedAt}
        {row.TriggeredByUsername ? ` by ${row.TriggeredByUsername}` : ""}
      </p>

      <div className="dash-panel flex items-center gap-4 flex-wrap" style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            background: `color-mix(in srgb, ${gradeColorVar} 18%, transparent)`,
            border: `2px solid ${gradeColorVar}`,
          }}
        >
          <span style={{ fontSize: "1.4rem", fontWeight: 700 }}>{row.Grade}</span>
        </div>
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", textTransform: "uppercase" }}>SEO Score</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{row.Score}/100</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: "0.85rem", color: "var(--ink-muted)" }}>
          {findings.length} finding(s) across {checks.length} check(s)
        </div>
      </div>

      <div className="dash-panel" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginTop: 0, marginBottom: "0.75rem" }}>Checks</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>Check</th>
                <th style={{ padding: "0.4rem" }}>Status</th>
                <th style={{ padding: "0.4rem" }}>Findings</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.check} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{c.label}</td>
                  <td style={{ padding: "0.4rem" }}>
                    {c.status === "ok" && <Badge tone="success">Passed</Badge>}
                    {c.status === "issues_found" && <Badge tone="warning">Issues Found</Badge>}
                    {c.status === "error" && <Badge tone="neutral">Check Failed</Badge>}
                  </td>
                  <td style={{ padding: "0.4rem" }}>{c.findingCount || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dash-panel">
        <h2 style={{ fontSize: "1.05rem", marginTop: 0, marginBottom: "0.75rem" }}>Findings</h2>
        {sortedFindings.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No issues found - every check passed.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedFindings.map((f, idx) => (
              <div key={idx} style={{ borderBottom: idx < sortedFindings.length - 1 ? "1px solid var(--grid)" : "none", paddingBottom: "0.75rem" }}>
                <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: "0.25rem" }}>
                  <Badge tone={severityTone(f.severity)}>{f.severity}</Badge>
                  <span style={{ fontWeight: 600 }}>{f.title}</span>
                </div>
                {f.detail && <p style={{ margin: "0.25rem 0", color: "var(--ink-muted)", fontSize: "0.85rem" }}>{f.detail}</p>}
                {f.evidence && (
                  <pre
                    style={{
                      margin: "0.25rem 0 0",
                      padding: "0.5rem",
                      background: "var(--surface-2)",
                      borderRadius: 6,
                      fontSize: "0.78rem",
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {f.evidence}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
