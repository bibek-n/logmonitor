import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";
import { createGroupSchema } from "@/lib/webAccessControl/schema";

export async function GET() {
  const wac = await requireWebAccessControlPermission("wac_view");
  if (!isWebAccessControlSession(wac)) return wac;

  const db = await getDb();
  const result = await db.query(`
    SELECT g.Id, g.Name, g.Description, g.IsBuiltIn,
      (SELECT COUNT(*) FROM Staff s WHERE s.WacGroupId = g.Id) AS StaffCount
    FROM WacGroups g
    ORDER BY g.IsBuiltIn DESC, g.Name ASC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const wac = await requireWebAccessControlPermission("wac_staff_group_manage");
  if (!isWebAccessControlSession(wac)) return wac;

  const body = await req.json().catch(() => null);
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid group payload" }, { status: 400 });

  const db = await getDb();
  const existing = await db
    .request()
    .input("name", sql.NVarChar, parsed.data.name)
    .query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM WacGroups WHERE Name = @name");
  if (existing.recordset[0].Cnt > 0) {
    return NextResponse.json({ ok: false, error: "A group with this name already exists" }, { status: 400 });
  }

  const inserted = await db
    .request()
    .input("name", sql.NVarChar, parsed.data.name)
    .input("description", sql.NVarChar, parsed.data.description ?? null)
    .query<{ Id: number }>(`
      INSERT INTO WacGroups (Name, Description, IsBuiltIn) OUTPUT INSERTED.Id
      VALUES (@name, @description, 0)
    `);

  await logAdminAction({
    admin: wac,
    section: "web-access-control",
    action: "group_create",
    req,
    details: JSON.stringify({ new: { name: parsed.data.name, description: parsed.data.description ?? null } }),
  });

  return NextResponse.json({ ok: true, data: { id: inserted.recordset[0].Id } });
}
