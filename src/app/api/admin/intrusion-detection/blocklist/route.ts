import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";

const IP_OR_CIDR_PATTERN = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^[0-9a-fA-F:]+(\/\d{1,3})?$/;

export async function GET() {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const db = await getDb();
  const result = await db.query(`
    SELECT Id, IpOrCidr, Reason, Source, IsActive, CreatedByUserId, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt, CONVERT(VARCHAR(19), ExpiresAt, 126) AS ExpiresAt
    FROM SecurityIpBlocklist ORDER BY CreatedAt DESC
  `);
  return NextResponse.json({ ok: true, data: result.recordset });
}

// IMPORTANT: this only records an entry in SecurityIpBlocklist - it does NOT touch the
// Windows Firewall, IIS IP restrictions, or anything else that would actually block traffic.
// Real enforcement is a Phase 2 response-action (tracked separately, dry-run by default,
// requires explicit confirmation) - see the IDS Phase 2 tasks. Recording the *intent* to
// block here is still useful on its own (dashboard visibility, audit trail, future
// enforcement backlog) without carrying any of the risk of an automated action.
export async function POST(req: NextRequest) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const body = await req.json().catch(() => null);
  const ipOrCidr = typeof body?.ipOrCidr === "string" ? body.ipOrCidr.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;
  const expiresInHours = Number.isFinite(body?.expiresInHours) ? Number(body.expiresInHours) : null;

  if (!IP_OR_CIDR_PATTERN.test(ipOrCidr)) {
    return NextResponse.json({ ok: false, error: "Invalid IP address or CIDR range." }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("ipOrCidr", sql.VarChar, ipOrCidr)
    .input("reason", sql.NVarChar, reason)
    .input("userId", sql.Int, session.userId)
    .input("expiresAt", sql.DateTime2, expiresInHours ? new Date(Date.now() + expiresInHours * 3600 * 1000) : null)
    .query(`INSERT INTO SecurityIpBlocklist (IpOrCidr, Reason, Source, CreatedByUserId, ExpiresAt) VALUES (@ipOrCidr, @reason, 'Manual', @userId, @expiresAt)`);

  await logAdminAction({ admin: session, section: "intrusion-detection", action: "blocklist_add", details: `${ipOrCidr}${reason ? ` (${reason})` : ""} [tracking only, not enforced]`, req });

  return NextResponse.json({ ok: true, note: "This entry is tracked for visibility only - it does not block any traffic yet. Enforcement is a Phase 2 feature." });
}
