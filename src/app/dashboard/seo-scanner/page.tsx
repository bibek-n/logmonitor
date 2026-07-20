import Link from "next/link";
import { getDb } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { Badge } from "@/components/ui/Badge";
import { WebsiteScanPanel } from "@/components/seoScanner/WebsiteScanPanel";

export const dynamic = "force-dynamic";

interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
  Environment: string;
  LastScanId: number | null;
  LastScore: number | null;
  LastGrade: string | null;
  LastScanAt: string | null;
}

function gradeTone(grade: string | null): "success" | "warning" | "danger" | "neutral" {
  if (!grade) return "neutral";
  if (grade === "A" || grade === "B") return "success";
  if (grade === "C") return "warning";
  return "danger";
}

export default async function SeoScannerPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>SEO Scanner</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view SEO Scanner results.</p>
      </div>
    );
  }

  const db = await getDb();
  const result = await db.query<WebsiteRow>`
    SELECT w.Id, w.Name, w.Url, w.Environment,
      (SELECT TOP 1 Id FROM SeoScans s WHERE s.WebsiteId = w.Id ORDER BY s.ScannedAt DESC) AS LastScanId,
      (SELECT TOP 1 Score FROM SeoScans s WHERE s.WebsiteId = w.Id ORDER BY s.ScannedAt DESC) AS LastScore,
      (SELECT TOP 1 Grade FROM SeoScans s WHERE s.WebsiteId = w.Id ORDER BY s.ScannedAt DESC) AS LastGrade,
      CONVERT(VARCHAR(19), (SELECT TOP 1 ScannedAt FROM SeoScans s WHERE s.WebsiteId = w.Id ORDER BY s.ScannedAt DESC), 126) AS LastScanAt
    FROM Websites w
    WHERE w.Enabled = 1
    ORDER BY w.Name ASC
  `;
  const websites = result.recordset;

  const scannedCount = websites.filter((w) => w.LastScanAt).length;
  const avgScore = scannedCount
    ? Math.round(websites.reduce((sum, w) => sum + (w.LastScore ?? 0), 0) / scannedCount)
    : null;

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>SEO Scanner</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Checks robots.txt, sitemap.xml, meta tags, canonical URL, broken links, image alt text, Open Graph, Twitter
        Cards, and structured data (JSON-LD) for every saved website. Pick a site below and scan it on demand.
      </p>

      <div className="flex gap-3 flex-wrap" style={{ marginBottom: "1.5rem" }}>
        <div className="dash-panel" style={{ padding: "0.75rem 1rem", minWidth: 140 }}>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", textTransform: "uppercase" }}>Websites Scanned</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>
            {scannedCount} / {websites.length}
          </div>
        </div>
        <div className="dash-panel" style={{ padding: "0.75rem 1rem", minWidth: 140 }}>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", textTransform: "uppercase" }}>Average Score</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{avgScore !== null ? `${avgScore}/100` : "—"}</div>
        </div>
      </div>

      <WebsiteScanPanel />

      <div className="dash-panel">
        {websites.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            No websites saved yet - add one on the{" "}
            <Link href="/dashboard/audit/websites" style={{ color: "var(--primary)" }}>
              Audit Websites
            </Link>{" "}
            page, then come back here to scan it.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "0.4rem" }}>Website</th>
                  <th style={{ padding: "0.4rem" }}>Environment</th>
                  <th style={{ padding: "0.4rem" }}>Score</th>
                  <th style={{ padding: "0.4rem" }}>Grade</th>
                  <th style={{ padding: "0.4rem" }}>Last Scanned</th>
                </tr>
              </thead>
              <tbody>
                {websites.map((w) => (
                  <tr key={w.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>
                      {w.LastScanId ? (
                        <Link href={`/dashboard/seo-scanner/scans/${w.LastScanId}`} style={{ color: "var(--primary)" }}>
                          {w.Name}
                        </Link>
                      ) : (
                        w.Name
                      )}
                      <div style={{ fontSize: "0.74rem", color: "var(--ink-muted)" }}>{w.Url}</div>
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <Badge tone="neutral">{w.Environment}</Badge>
                    </td>
                    <td style={{ padding: "0.4rem" }}>{w.LastScore !== null ? `${w.LastScore}/100` : "—"}</td>
                    <td style={{ padding: "0.4rem" }}>{w.LastGrade ? <Badge tone={gradeTone(w.LastGrade)}>{w.LastGrade}</Badge> : "—"}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{w.LastScanAt ?? "Never scanned"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
