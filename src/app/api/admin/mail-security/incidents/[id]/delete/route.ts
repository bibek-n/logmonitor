import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";

// Real (Source='Live') incidents are the security audit trail and are never deletable, per
// the spec's own "immutable security audit records where supported" control - only
// Source='Simulation' rows (Test Policy runs, never a real message) can be cleared out as
// test-data cleanup. This is a deliberate exception to normal soft-delete, not an oversight -
// MailSecurityIncidents has no DeletedAt column at all for Live rows.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_view_incidents");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, Number(id)).query<{ Source: string }>("SELECT Source FROM MailSecurityIncidents WHERE Id = @id");
  const incident = result.recordset[0];
  if (!incident) return NextResponse.json({ ok: false, error: "Incident not found" }, { status: 404 });

  if (incident.Source !== "Simulation") {
    return NextResponse.json({ ok: false, error: "Live incidents are immutable audit records and cannot be deleted." }, { status: 403 });
  }

  await db.request().input("id", sql.Int, Number(id)).query("DELETE FROM MailSecurityIncidents WHERE Id = @id");

  await logAdminAction({ admin: mail, section: "mail-security", action: "incident_delete_simulation", details: String(id), req });

  return NextResponse.json({ ok: true });
}
