import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";
import { createAllowlistEntrySchema } from "@/lib/webAccessControl/schema";

export async function GET() {
  const wac = await requireWebAccessControlPermission("wac_view");
  if (!isWebAccessControlSession(wac)) return wac;

  const db = await getDb();
  const result = await db.query(`
    SELECT a.Id, a.ServiceName, a.Domain, a.IpAddress, a.Port, a.MatchType, a.IsCritical, a.Notes,
      CONVERT(VARCHAR(33), a.CreatedAt, 126) AS CreatedAt, CONVERT(VARCHAR(33), a.UpdatedAt, 126) AS UpdatedAt,
      sy.Status AS SophosSyncStatus
    FROM WacCriticalAllowlist a
    LEFT JOIN WacSyncStatus sy ON sy.PolicyType = 'CriticalAllowlist' AND sy.PolicyId = a.Id
    ORDER BY a.ServiceName ASC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const wac = await requireWebAccessControlPermission("wac_allowlist_manage");
  if (!isWebAccessControlSession(wac)) return wac;

  const body = await req.json().catch(() => null);
  const parsed = createAllowlistEntrySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid allowlist payload" }, { status: 400 });
  const a = parsed.data;

  const db = await getDb();
  const inserted = await db
    .request()
    .input("serviceName", sql.NVarChar, a.serviceName)
    .input("domain", sql.NVarChar, a.domain ?? null)
    .input("ipAddress", sql.VarChar, a.ipAddress ?? null)
    .input("port", sql.Int, a.port ?? null)
    .input("matchType", sql.VarChar, a.matchType)
    .input("isCritical", sql.Bit, a.isCritical)
    .input("notes", sql.NVarChar, a.notes ?? null)
    .input("createdByUserId", sql.Int, wac.userId)
    .query<{ Id: number }>(`
      INSERT INTO WacCriticalAllowlist
        (ServiceName, Domain, IpAddress, Port, MatchType, IsCritical, Notes, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@serviceName, @domain, @ipAddress, @port, @matchType, @isCritical, @notes, @createdByUserId, @createdByUserId)
    `);

  await logAdminAction({
    admin: wac,
    section: "web-access-control",
    action: "allowlist_create",
    req,
    details: JSON.stringify({ new: a }),
  });

  return NextResponse.json({ ok: true, data: { id: inserted.recordset[0].Id } });
}
