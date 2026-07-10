import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query`
    SELECT g.Id, g.Name, g.Description, COUNT(m.UserId) AS MemberCount
    FROM UserGroups g
    LEFT JOIN UserGroupMembers m ON m.GroupId = g.Id
    GROUP BY g.Id, g.Name, g.Description
    ORDER BY g.Name ASC
  `;
  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });

  const db = await getDb();
  await db
    .request()
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, typeof body?.description === "string" ? body.description.trim() || null : null)
    .query("INSERT INTO UserGroups (Name, Description) VALUES (@name, @description)");

  await logAdminAction({ admin, section: "users_access", action: "create_user_group", details: name, req });

  return NextResponse.json({ ok: true });
}
