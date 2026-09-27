import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";
import { assignStaffGroupSchema } from "@/lib/webAccessControl/schema";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const wac = await requireWebAccessControlPermission("wac_staff_group_manage");
  if (!isWebAccessControlSession(wac)) return wac;

  const { id } = await params;
  const staffId = Number(id);
  const body = await req.json().catch(() => null);
  const parsed = assignStaffGroupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });

  const db = await getDb();
  const staffRow = await db.request().input("id", sql.Int, staffId).query<{ Name: string; WacGroupId: number | null }>("SELECT Name, WacGroupId FROM Staff WHERE Id = @id");
  const before = staffRow.recordset[0];
  if (!before) return NextResponse.json({ ok: false, error: "Staff member not found" }, { status: 404 });

  if (parsed.data.wacGroupId !== null) {
    const groupExists = await db.request().input("id", sql.Int, parsed.data.wacGroupId).query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM WacGroups WHERE Id = @id");
    if (groupExists.recordset[0].Cnt === 0) return NextResponse.json({ ok: false, error: "Staff group not found" }, { status: 400 });
  }

  await db
    .request()
    .input("id", sql.Int, staffId)
    .input("wacGroupId", sql.Int, parsed.data.wacGroupId)
    .query("UPDATE Staff SET WacGroupId = @wacGroupId, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({
    admin: wac,
    section: "web-access-control",
    action: "staff_group_assign",
    req,
    details: JSON.stringify({ staffId, staffName: before.Name, old: { wacGroupId: before.WacGroupId }, new: { wacGroupId: parsed.data.wacGroupId } }),
  });

  return NextResponse.json({ ok: true });
}
