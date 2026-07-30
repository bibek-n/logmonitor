import { getMailSession } from "@/lib/requireMailPolicyPermission";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const cardStyle: React.CSSProperties = {
  padding: "1rem",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  minWidth: 180,
};

export default async function MailReportsPage() {
  const mail = await getMailSession("mail_view_incidents");
  if (!mail) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Reports</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Mail Protection reports.</p>
      </div>
    );
  }

  const db = await getDb();
  const [totals, byAction, topExtensions, topCloudProviders] = await Promise.all([
    db.query<{ Total: number }>("SELECT COUNT(*) AS Total FROM MailSecurityIncidents"),
    db.query<{ ActionTaken: string; Cnt: number }>("SELECT ActionTaken, COUNT(*) AS Cnt FROM MailSecurityIncidents GROUP BY ActionTaken ORDER BY COUNT(*) DESC"),
    db.query<{ DeclaredExtension: string | null; Cnt: number }>(
      "SELECT DeclaredExtension, COUNT(*) AS Cnt FROM MailIncidentAttachments WHERE Blocked = 1 GROUP BY DeclaredExtension ORDER BY COUNT(*) DESC"
    ),
    db.query<{ CloudProvider: string | null; Cnt: number }>(
      "SELECT CloudProvider, COUNT(*) AS Cnt FROM MailIncidentUrls WHERE Blocked = 1 AND CloudProvider IS NOT NULL GROUP BY CloudProvider ORDER BY COUNT(*) DESC"
    ),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Reports</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        All figures come from Test Policy simulations in Stage 1 - there is no live provider connected yet, so
        these do not reflect real mail traffic.
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div style={cardStyle}>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Total incidents</div>
          <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{totals.recordset[0].Total}</div>
        </div>
        {byAction.recordset.map((a) => (
          <div key={a.ActionTaken} style={cardStyle}>
            <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>{a.ActionTaken}</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{a.Cnt}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className="dash-panel">
          <h3 style={{ fontSize: "1rem", marginTop: 0 }}>Most Frequently Blocked File Types</h3>
          {topExtensions.recordset.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No blocked attachments yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem" }}>
              {topExtensions.recordset.map((e, i) => (
                <li key={i}>
                  .{e.DeclaredExtension ?? "(none)"} - {e.Cnt}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="dash-panel">
          <h3 style={{ fontSize: "1rem", marginTop: 0 }}>Most Frequently Blocked Cloud Providers</h3>
          {topCloudProviders.recordset.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No blocked links yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem" }}>
              {topCloudProviders.recordset.map((c, i) => (
                <li key={i}>
                  {c.CloudProvider} - {c.Cnt}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
