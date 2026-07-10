import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query`SELECT Id, Name, Description FROM Departments ORDER BY Name ASC`;
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
    .query("INSERT INTO Departments (Name, Description) VALUES (@name, @description)");

  await logAdminAction({ admin, section: "organization", action: "create_department", details: name, req });

  return NextResponse.json({ ok: true });
}
