import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";

// Backs the "Protected Application" filter dropdown on the Alerts/Events tabs - includes
// both the fixed apps (LogMonitor itself, the Sophos firewall) and every website synced in
// from the existing Websites list (Audit Websites & SSL Certificates), so a website added
// there shows up here automatically without a separate registration step.
export async function GET() {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const db = await getDb();
  const result = await db.query`
    SELECT Id, Name, AppType, WebsiteId
    FROM SecurityProtectedApplications
    WHERE IsActive = 1
    ORDER BY AppType, Name
  `;

  return NextResponse.json({ ok: true, data: result.recordset });
}
