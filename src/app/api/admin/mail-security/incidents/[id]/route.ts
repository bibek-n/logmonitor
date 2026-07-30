import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_view_incidents");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const db = await getDb();

  const incidentResult = await db.request().input("id", sql.Int, Number(id)).query(`
    SELECT i.*, p.Name AS PolicyName, CONVERT(VARCHAR(19), i.DetectedAt, 126) AS DetectedAtFormatted
    FROM MailSecurityIncidents i
    LEFT JOIN MailBlockingPolicies p ON p.Id = i.MatchedPolicyId
    WHERE i.Id = @id
  `);
  const incident = incidentResult.recordset[0];
  if (!incident) return NextResponse.json({ ok: false, error: "Incident not found" }, { status: 404 });

  const attachments = await db.request().input("id", sql.Int, Number(id)).query("SELECT * FROM MailIncidentAttachments WHERE IncidentId = @id");
  const urls = await db.request().input("id", sql.Int, Number(id)).query("SELECT * FROM MailIncidentUrls WHERE IncidentId = @id");

  return NextResponse.json({ ok: true, data: { incident, attachments: attachments.recordset, urls: urls.recordset } });
}
