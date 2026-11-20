import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";

// A minimal user picker for the Alerts "Assigned To" column/dropdown - scoped to the
// intrusion-detection viewer role rather than the separate Company Settings user list, same
// reasoning as /api/admin/monitoring/users (that route's own comment explains why each
// module gets its own thin list rather than sharing one gated by a different permission).
export async function GET() {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const db = await getDb();
  const result = await db.query<{ Id: number; Username: string }>("SELECT Id, Username FROM Users WHERE IsActive = 1 ORDER BY Username ASC");

  return NextResponse.json({ ok: true, data: result.recordset });
}
