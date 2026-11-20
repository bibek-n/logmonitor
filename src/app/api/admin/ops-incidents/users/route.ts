import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireOpsIncidentsPermission, isOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";

// A minimal user picker for the incident "Owner" dropdown - scoped to this module's own
// permission rather than a shared Company Settings list, same reasoning as every other
// per-module user-list endpoint in this app (see /api/admin/monitoring/users's own comment).
export async function GET() {
  const oi = await requireOpsIncidentsPermission("oi_view");
  if (!isOpsIncidentsSession(oi)) return oi;

  const db = await getDb();
  const result = await db.query<{ Id: number; Username: string }>("SELECT Id, Username FROM Users WHERE IsActive = 1 ORDER BY Username ASC");

  return NextResponse.json({ ok: true, data: result.recordset });
}
