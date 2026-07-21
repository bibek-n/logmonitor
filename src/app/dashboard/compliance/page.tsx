import Link from "next/link";
import { getAdminSession } from "@/lib/requireAdmin";
import { getDb } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RunAutoCheckButton } from "@/components/compliance/RunAutoCheckButton";

export const dynamic = "force-dynamic";

interface FrameworkRow {
  Id: number;
  Key: string;
  Name: string;
  Description: string | null;
  Total: number;
  Implemented: number;
  InProgress: number;
  NotStarted: number;
  NotApplicable: number;
}

function scoreTone(pct: number | null): "success" | "warning" | "danger" | "neutral" {
  if (pct === null) return "neutral";
  if (pct >= 80) return "success";
  if (pct >= 40) return "warning";
  return "danger";
}

export default async function CompliancePage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Compliance</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view this page.</p>
      </div>
    );
  }

  const db = await getDb();
  const result = await db.query<FrameworkRow>`
    SELECT f.Id, f.[Key], f.Name, f.Description,
      COUNT(c.Id) AS Total,
      SUM(CASE WHEN c.Status = 'implemented' THEN 1 ELSE 0 END) AS Implemented,
      SUM(CASE WHEN c.Status = 'in_progress' THEN 1 ELSE 0 END) AS InProgress,
      SUM(CASE WHEN c.Status = 'not_started' THEN 1 ELSE 0 END) AS NotStarted,
      SUM(CASE WHEN c.Status = 'not_applicable' THEN 1 ELSE 0 END) AS NotApplicable
    FROM ComplianceFrameworks f
    LEFT JOIN ComplianceControls c ON c.FrameworkId = f.Id
    GROUP BY f.Id, f.[Key], f.Name, f.Description
    ORDER BY f.Name ASC
  `;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: "0.25rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Compliance</h1>
        <RunAutoCheckButton />
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.25rem" }}>
        Tracks assessment status, evidence, and notes against a curated set of controls per framework - this is a
        tracking aid built from this app&apos;s own monitoring data, not a certified audit or attestation. Some
        controls are auto-checked from live data (malware scans, SSL certs, backups, MFA enrollment, etc.); most
        require manual assessment.
      </p>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {result.recordset.map((r) => {
          const applicable = r.Total - r.NotApplicable;
          const scorePercent = applicable > 0 ? Math.round((r.Implemented / applicable) * 100) : null;
          return (
            <Link key={r.Id} href={`/dashboard/compliance/${r.Key}`} style={{ textDecoration: "none", color: "inherit" }}>
              <Card hoverLift className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>{r.Name}</h3>
                  <Badge tone={scoreTone(scorePercent)}>{scorePercent !== null ? `${scorePercent}%` : "—"}</Badge>
                </div>
                <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", margin: 0 }}>{r.Description}</p>
                <dl style={{ margin: 0, fontSize: "0.8rem", marginTop: "0.25rem" }}>
                  {[
                    ["Implemented", r.Implemented],
                    ["In Progress", r.InProgress],
                    ["Not Started", r.NotStarted],
                    ["Not Applicable", r.NotApplicable],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between" style={{ padding: "0.15rem 0" }}>
                      <dt style={{ color: "var(--ink-muted)" }}>{label}</dt>
                      <dd style={{ margin: 0 }}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <p style={{ color: "var(--ink-muted)", fontSize: "0.74rem", margin: 0 }}>{r.Total} control(s) tracked</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
