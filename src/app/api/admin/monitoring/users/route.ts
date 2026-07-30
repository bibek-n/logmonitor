import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";

// A minimal user picker for incident "Assign to" / InApp alert-contact "Username" fields -
// scoped to mon_incidents_view rather than requiring the separate Company Settings users
// permission, since a Monitoring Manager role needs this list without needing full user
// management access.
export async function GET() {
  const mon = await requireMonitoringPermission("mon_incidents_view");
  if (!isMonitoringSession(mon)) return mon;

  const db = await getDb();
  const result = await db.query<{ Id: number; Username: string }>("SELECT Id, Username FROM Users WHERE IsActive = 1 ORDER BY Username ASC");

  return NextResponse.json({ ok: true, data: result.recordset });
}
