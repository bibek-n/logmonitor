import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";
import { updateGroupSchema } from "@/lib/webAccessControl/schema";

// Built-in groups (Admin/Accounts/Sales/HR/General Staff) are renameable/editable like any
// other row - IsBuiltIn only guards against DELETE, per the spec.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const wac = await requireWebAccessControlPermission("wac_staff_group_manage");
  if (!isWebAccessControlSession(wac)) return wac;

  const { id } = await params;
  const groupId = Number(id);
  const body = await req.json().catch(() => null);
  const parsed = updateGroupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid group payload" }, { status: 400 });

  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, groupId)
    .query<{ Name: string; Description: string | null }>("SELECT Name, Description FROM WacGroups WHERE Id = @id");
  const before = existing.recordset[0];
  if (!before) return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });

  const nextName = parsed.data.name ?? before.Name;
  const nextDescription = parsed.data.description !== undefined ? parsed.data.description : before.Description;

  await db
    .request()
    .input("id", sql.Int, groupId)
    .input("name", sql.NVarChar, nextName)
    .input("description", sql.NVarChar, nextDescription)
    .query("UPDATE WacGroups SET Name = @name, Description = @description, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({
    admin: wac,
    section: "web-access-control",
    action: "group_update",
    req,
    details: JSON.stringify({
      old: { name: before.Name, description: before.Description },
      new: { name: nextName, description: nextDescription },
    }),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const wac = await requireWebAccessControlPermission("wac_staff_group_manage");
  if (!isWebAccessControlSession(wac)) return wac;

  const { id } = await params;
  const groupId = Number(id);

  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, groupId)
    .query<{ Name: string; IsBuiltIn: boolean }>("SELECT Name, IsBuiltIn FROM WacGroups WHERE Id = @id");
  const group = existing.recordset[0];
  if (!group) return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });
  if (group.IsBuiltIn) {
    return NextResponse.json({ ok: false, error: "Built-in groups cannot be deleted (rename it instead)" }, { status: 400 });
  }

  const memberCheck = await db
    .request()
    .input("id", sql.Int, groupId)
    .query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM Staff WHERE WacGroupId = @id");
  if (memberCheck.recordset[0].Cnt > 0) {
    return NextResponse.json({ ok: false, error: "Reassign staff out of this group before deleting it" }, { status: 400 });
  }

  const ruleCheck = await db
    .request()
    .input("id", sql.Int, groupId)
    .query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM WacWebsiteRules WHERE WacGroupId = @id");
  if (ruleCheck.recordset[0].Cnt > 0) {
    return NextResponse.json({ ok: false, error: "Delete or reassign the website rules scoped to this group before deleting it" }, { status: 400 });
  }

  await db.request().input("id", sql.Int, groupId).query("DELETE FROM WacGroups WHERE Id = @id");

  await logAdminAction({ admin: wac, section: "web-access-control", action: "group_delete", req, details: JSON.stringify({ old: { name: group.Name } }) });

  return NextResponse.json({ ok: true });
}
