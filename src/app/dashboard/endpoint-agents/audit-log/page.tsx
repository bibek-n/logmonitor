import Link from "next/link";
import { getDb, sql } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

interface AuditRow {
  Id: number;
  ActionAt: string;
  Action: string;
  IpAddress: string | null;
  Username: string;
  ScreenshotId: number;
  CapturedAt: string;
  DeviceId: string;
  Hostname: string;
}

const ACTION_TONE: Record<string, "info" | "success" | "danger"> = {
  viewed: "info",
  downloaded: "success",
  deleted: "danger",
};

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Screenshot Audit Log</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view the audit log.</p>
      </div>
    );
  }

  const { action: actionFilter } = await searchParams;
  const db = await getDb();

  const request = db.request();
  let where = "1=1";
  if (actionFilter) {
    request.input("action", sql.VarChar, actionFilter);
    where += " AND al.Action = @action";
  }

  const result = await request.query<AuditRow>(`
    SELECT TOP 200 al.Id, al.ActionAt, al.Action, al.IpAddress, u.Username,
      al.ScreenshotId, sc.CapturedAt, sc.DeviceId, d.Hostname
    FROM ScreenshotAuditLog al
    JOIN Users u ON u.Id = al.UserId
    JOIN Screenshots sc ON sc.Id = al.ScreenshotId
    JOIN Devices d ON d.DeviceId = sc.DeviceId
    WHERE ${where}
    ORDER BY al.ActionAt DESC
  `);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Screenshot Audit Log</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Every time a screenshot is viewed, downloaded, or deleted, it&apos;s recorded here — including thumbnail
        loads on a device&apos;s detail page, since that counts as the image being rendered to an admin&apos;s screen.
      </p>

      <div className="flex gap-2 mb-4">
        {[
          { label: "All", value: undefined },
          { label: "Viewed", value: "viewed" },
          { label: "Downloaded", value: "downloaded" },
          { label: "Deleted", value: "deleted" },
        ].map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/dashboard/endpoint-agents/audit-log?action=${f.value}` : "/dashboard/endpoint-agents/audit-log"}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: actionFilter === f.value ? "var(--primary)" : "var(--surface-2)",
              color: actionFilter === f.value ? "#fff" : "var(--ink-secondary)",
              fontSize: "0.8rem",
              textDecoration: "none",
            }}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="dash-panel">
        {result.recordset.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No audit events yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}>When</th>
                <th style={{ padding: "0.5rem" }}>Action</th>
                <th style={{ padding: "0.5rem" }}>Admin user</th>
                <th style={{ padding: "0.5rem" }}>Device</th>
                <th style={{ padding: "0.5rem" }}>Screenshot captured</th>
                <th style={{ padding: "0.5rem" }}>IP address</th>
              </tr>
            </thead>
            <tbody>
              {result.recordset.map((r) => (
                <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.5rem" }}>{new Date(r.ActionAt).toLocaleString()}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <Badge tone={ACTION_TONE[r.Action] ?? "info"}>{r.Action}</Badge>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{r.Username}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <Link href={`/dashboard/endpoint-agents/${r.DeviceId}`} style={{ color: "var(--series-1)" }}>
                      {r.Hostname}
                    </Link>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{new Date(r.CapturedAt).toLocaleString()}</td>
                  <td style={{ padding: "0.5rem" }}>{r.IpAddress ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
