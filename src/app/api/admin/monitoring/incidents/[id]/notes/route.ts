import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { addIncidentNoteSchema } from "@/lib/websiteApiMonitoring/schema";
import { addIncidentNote } from "@/lib/websiteApiMonitoring/incidentService";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_incidents_view");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, Number(id)).query(`
    SELECT n.Id, n.IncidentId, n.UserId, u.Username, n.Note, CONVERT(VARCHAR(33), n.CreatedAt, 126) AS CreatedAt
    FROM IncidentNotes n
    LEFT JOIN Users u ON u.Id = n.UserId
    WHERE n.IncidentId = @id
    ORDER BY n.CreatedAt ASC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_incidents_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = addIncidentNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid note payload" }, { status: 400 });
  }

  const noteId = await addIncidentNote(Number(id), mon.userId, parsed.data.note);

  await logAdminAction({ admin: mon, section: "monitoring", action: "incident_note_add", details: `Incident #${id}`, req });

  return NextResponse.json({ ok: true, data: { id: noteId } });
}
