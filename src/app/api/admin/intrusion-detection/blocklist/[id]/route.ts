import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";

// Marks the entry inactive (reversible, matches "response actions must be reversible where
// technically possible") rather than deleting it - the history of what was once blocked and
// why stays available for audit purposes.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId) || entryId <= 0) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, entryId).query<{ IpOrCidr: string }>(`SELECT IpOrCidr FROM SecurityIpBlocklist WHERE Id = @id`);
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Entry not found." }, { status: 404 });

  await db.request().input("id", sql.Int, entryId).query(`UPDATE SecurityIpBlocklist SET IsActive = 0 WHERE Id = @id`);
  await logAdminAction({ admin: session, section: "intrusion-detection", action: "blocklist_remove", details: existing.recordset[0].IpOrCidr, req });

  return NextResponse.json({ ok: true });
}
