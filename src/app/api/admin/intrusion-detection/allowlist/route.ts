import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";

// Basic IPv4/IPv6 (with optional CIDR suffix) validator - deliberately conservative (rejects
// anything that isn't clearly an address/CIDR) since this value is later interpolated into
// firewall-adjacent logic in Phase 2; malformed input must never reach that far.
const IP_OR_CIDR_PATTERN = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^[0-9a-fA-F:]+(\/\d{1,3})?$/;

export async function GET() {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const db = await getDb();
  const result = await db.query(`
    SELECT Id, IpOrCidr, Reason, CreatedByUserId, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt, CONVERT(VARCHAR(19), ExpiresAt, 126) AS ExpiresAt
    FROM SecurityIpAllowlist ORDER BY CreatedAt DESC
  `);
  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const body = await req.json().catch(() => null);
  const ipOrCidr = typeof body?.ipOrCidr === "string" ? body.ipOrCidr.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;

  if (!IP_OR_CIDR_PATTERN.test(ipOrCidr)) {
    return NextResponse.json({ ok: false, error: "Invalid IP address or CIDR range." }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("ipOrCidr", sql.VarChar, ipOrCidr)
    .input("reason", sql.NVarChar, reason)
    .input("userId", sql.Int, session.userId)
    .query(`INSERT INTO SecurityIpAllowlist (IpOrCidr, Reason, CreatedByUserId) VALUES (@ipOrCidr, @reason, @userId)`);

  await logAdminAction({ admin: session, section: "intrusion-detection", action: "allowlist_add", details: `${ipOrCidr}${reason ? ` (${reason})` : ""}`, req });

  return NextResponse.json({ ok: true });
}
