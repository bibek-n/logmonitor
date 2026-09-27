import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";
import { deleteAllowlistEntrySchema, updateAllowlistEntrySchema } from "@/lib/webAccessControl/schema";

interface AllowlistRow {
  Id: number;
  ServiceName: string;
  Domain: string | null;
  IpAddress: string | null;
  Port: number | null;
  MatchType: string;
  IsCritical: boolean;
  Notes: string | null;
}

// Every mutation here requires `acknowledged: true` in the body, in addition to whatever
// confirmation dialog the UI already shows - this is a "Critical Application Allowlist" per
// the spec, and an accidental update/delete could silently stop enforcing an override that
// keeps a business-critical service reachable. The explicit-warning requirement is enforced
// server-side, not just as a UI affordance a stray script could bypass.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const wac = await requireWebAccessControlPermission("wac_allowlist_manage");
  if (!isWebAccessControlSession(wac)) return wac;

  const { id } = await params;
  const entryId = Number(id);
  const body = await req.json().catch(() => null);
  const parsed = updateAllowlistEntrySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid allowlist payload" }, { status: 400 });
  const a = parsed.data;

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, entryId).query<AllowlistRow>("SELECT * FROM WacCriticalAllowlist WHERE Id = @id");
  const before = existing.recordset[0];
  if (!before) return NextResponse.json({ ok: false, error: "Allowlist entry not found" }, { status: 404 });

  const next = {
    serviceName: a.serviceName ?? before.ServiceName,
    domain: a.domain !== undefined ? a.domain : before.Domain,
    ipAddress: a.ipAddress !== undefined ? a.ipAddress : before.IpAddress,
    port: a.port !== undefined ? a.port : before.Port,
    matchType: a.matchType ?? before.MatchType,
    isCritical: a.isCritical ?? before.IsCritical,
    notes: a.notes !== undefined ? a.notes : before.Notes,
  };
  if (!next.domain && !next.ipAddress) {
    return NextResponse.json({ ok: false, error: "Either domain or ipAddress is required" }, { status: 400 });
  }

  await db
    .request()
    .input("id", sql.Int, entryId)
    .input("serviceName", sql.NVarChar, next.serviceName)
    .input("domain", sql.NVarChar, next.domain)
    .input("ipAddress", sql.VarChar, next.ipAddress)
    .input("port", sql.Int, next.port)
    .input("matchType", sql.VarChar, next.matchType)
    .input("isCritical", sql.Bit, next.isCritical)
    .input("notes", sql.NVarChar, next.notes)
    .input("updatedByUserId", sql.Int, wac.userId)
    .query(`
      UPDATE WacCriticalAllowlist SET
        ServiceName = @serviceName, Domain = @domain, IpAddress = @ipAddress, Port = @port,
        MatchType = @matchType, IsCritical = @isCritical, Notes = @notes,
        UpdatedByUserId = @updatedByUserId, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);

  await logAdminAction({
    admin: wac,
    section: "web-access-control",
    action: "allowlist_update",
    req,
    details: JSON.stringify({
      old: { serviceName: before.ServiceName, domain: before.Domain, ipAddress: before.IpAddress, port: before.Port, isCritical: before.IsCritical },
      new: next,
    }),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const wac = await requireWebAccessControlPermission("wac_allowlist_manage");
  if (!isWebAccessControlSession(wac)) return wac;

  const { id } = await params;
  const entryId = Number(id);
  const body = await req.json().catch(() => ({}));
  const parsed = deleteAllowlistEntrySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Acknowledgement required" }, { status: 400 });

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, entryId).query<AllowlistRow>("SELECT * FROM WacCriticalAllowlist WHERE Id = @id");
  const before = existing.recordset[0];
  if (!before) return NextResponse.json({ ok: false, error: "Allowlist entry not found" }, { status: 404 });

  await db.request().input("id", sql.Int, entryId).query("DELETE FROM WacSyncStatus WHERE PolicyType = 'CriticalAllowlist' AND PolicyId = @id");
  await db.request().input("id", sql.Int, entryId).query("DELETE FROM WacCriticalAllowlist WHERE Id = @id");

  await logAdminAction({
    admin: wac,
    section: "web-access-control",
    action: "allowlist_delete",
    req,
    details: JSON.stringify({ old: { serviceName: before.ServiceName, domain: before.Domain, ipAddress: before.IpAddress } }),
  });

  return NextResponse.json({ ok: true });
}
