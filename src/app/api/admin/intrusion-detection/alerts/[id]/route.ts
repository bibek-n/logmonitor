import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";

// Full alert investigation payload: the alert itself, its analyst notes, its status change
// history, the raw contributing events (evidence), and a small set of "related alerts"
// (same source IP, different rule) for cross-referencing - everything the alert
// investigation page needs in one request, avoiding an N+1 waterfall on the client.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const { id } = await params;
  const alertId = Number(id);
  if (!Number.isInteger(alertId) || alertId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid alert id." }, { status: 400 });
  }

  const db = await getDb();

  const alertResult = await db.request().input("id", sql.Int, alertId).query(`
    SELECT a.*, r.Name AS RuleName, r.Description AS RuleDescription, r.Tags AS RuleTags, r.References_ AS RuleReferences,
      pa.Name AS ProtectedApplicationName
    FROM SecurityAlerts a
    LEFT JOIN SecurityDetectionRules r ON r.Id = a.RuleId
    LEFT JOIN SecurityProtectedApplications pa ON pa.Id = a.ProtectedApplicationId
    WHERE a.Id = @id
  `);
  const alert = alertResult.recordset[0];
  if (!alert) return NextResponse.json({ ok: false, error: "Alert not found." }, { status: 404 });

  const [notes, statusHistory, events, related, ipProfile] = await Promise.all([
    db.request().input("id", sql.Int, alertId).query(`
      SELECT Id, UserId, Username, Note, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
      FROM SecurityAlertNotes WHERE AlertId = @id ORDER BY CreatedAt DESC
    `),
    db.request().input("id", sql.Int, alertId).query(`
      SELECT Id, OldStatus, NewStatus, ChangedByUsername, Reason, CONVERT(VARCHAR(19), ChangedAt, 126) AS ChangedAt
      FROM SecurityAlertStatusHistory WHERE AlertId = @id ORDER BY ChangedAt DESC
    `),
    db.request().input("id", sql.Int, alertId).query(`
      SELECT TOP 50 Id, DataSource, CONVERT(VARCHAR(19), EventTime, 126) AS EventTime, SourceIp, RequestMethod, RequestPath, ResponseStatus, UserAgent, EvidenceSummary
      FROM SecurityEvents WHERE AlertId = @id ORDER BY EventTime DESC
    `),
    db.request().input("id", sql.Int, alertId).input("sourceIp", sql.VarChar, alert.SourceIp).query(`
      SELECT TOP 10 Id, Category, Severity, Status, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
      FROM SecurityAlerts WHERE SourceIp = @sourceIp AND Id != @id ORDER BY CreatedAt DESC
    `),
    alert.SourceIp
      ? db.request().input("ip", sql.VarChar, alert.SourceIp).query(`SELECT TotalEvents, TotalAlerts, CONVERT(VARCHAR(19), FirstSeenAt, 126) AS FirstSeenAt FROM SecurityIpProfiles WHERE IpAddress = @ip`)
      : Promise.resolve({ recordset: [] as { TotalEvents: number; TotalAlerts: number; FirstSeenAt: string }[] }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      alert,
      notes: notes.recordset,
      statusHistory: statusHistory.recordset,
      events: events.recordset,
      relatedAlerts: related.recordset,
      ipProfile: ipProfile.recordset[0] ?? null,
    },
  });
}
