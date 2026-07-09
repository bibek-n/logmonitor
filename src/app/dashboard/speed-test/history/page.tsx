import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ResultRow {
  Id: number;
  Category: string;
  Target: string;
  PingMs: number | null;
  DownloadMbps: number | null;
  UploadMbps: number | null;
  CreatedAt: string;
}

function StatTile({ label, value, status }: { label: string; value: string | number; status: string }) {
  return (
    <div className={`stat-tile status-${status}`}>
      <div className="label">
        <span className={`status-dot status-${status}`} />
        {label}
      </div>
      <div className="value">{value}</div>
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  nepal: "Nepal",
  international: "International",
  "local-ip": "Local IP",
};

export default async function SpeedTestHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const db = await getDb();

  const result = await db.query<ResultRow>(`
    SELECT TOP 100 Id, Category, Target, PingMs, DownloadMbps, UploadMbps, CreatedAt
    FROM SpeedTestResults
    ORDER BY CreatedAt DESC
  `);
  const all = result.recordset;
  const rows = category ? all.filter((r) => r.Category === category) : all;

  const counts = { nepal: 0, international: 0, "local-ip": 0 } as Record<string, number>;
  all.forEach((r) => {
    counts[r.Category] = (counts[r.Category] ?? 0) + 1;
  });

  return (
    <div>
      <h1>Speed Test History</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Every completed speed test (Nepal, International, or Local IP) is saved here automatically — last 100
        shown, most recent first.
      </p>

      <div className="stat-grid">
        <StatTile label="Total Tests" value={all.length} status="unknown" />
        <StatTile label="Nepal" value={counts.nepal} status="unknown" />
        <StatTile label="International" value={counts.international} status="unknown" />
        <StatTile label="Local IP" value={counts["local-ip"]} status="unknown" />
      </div>

      <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginBottom: "0.4rem" }}>
        Filter by category:
      </p>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {["", "nepal", "international", "local-ip"].map((c) => (
          <Link
            key={c || "all"}
            href={c ? `/dashboard/speed-test/history?category=${c}` : "/dashboard/speed-test/history"}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: (category ?? "") === c ? "var(--series-1)" : "var(--plane)",
              color: (category ?? "") === c ? "#fff" : "var(--ink)",
              fontSize: "0.82rem",
              textDecoration: "none",
            }}
          >
            {c ? CATEGORY_LABEL[c] : "All"}
          </Link>
        ))}
      </div>

      <div className="dash-panel">
        {rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No speed tests recorded yet — run one from the Speed Test pages.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}>Date/Time</th>
                <th style={{ padding: "0.5rem" }}>Category</th>
                <th style={{ padding: "0.5rem" }}>Target</th>
                <th style={{ padding: "0.5rem" }}>Ping</th>
                <th style={{ padding: "0.5rem" }}>Download</th>
                <th style={{ padding: "0.5rem" }}>Upload</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{new Date(r.CreatedAt).toLocaleString()}</td>
                  <td style={{ padding: "0.5rem" }}>{CATEGORY_LABEL[r.Category] ?? r.Category}</td>
                  <td style={{ padding: "0.5rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.Target}
                  </td>
                  <td style={{ padding: "0.5rem" }}>{r.PingMs !== null ? `${r.PingMs}ms` : "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{r.DownloadMbps !== null ? `${r.DownloadMbps} Mbps` : "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{r.UploadMbps !== null ? `${r.UploadMbps} Mbps` : "not supported"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
