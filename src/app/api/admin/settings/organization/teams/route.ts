import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query`
    SELECT t.Id, t.Name, t.Description, t.DepartmentId, d.Name AS DepartmentName
    FROM Teams t LEFT JOIN Departments d ON d.Id = t.DepartmentId
    ORDER BY t.Name ASC
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
    .input("departmentId", sql.Int, Number.isInteger(body?.departmentId) ? body.departmentId : null)
    .query("INSERT INTO Teams (Name, Description, DepartmentId) VALUES (@name, @description, @departmentId)");

  await logAdminAction({ admin, section: "organization", action: "create_team", details: name, req });

  return NextResponse.json({ ok: true });
}
