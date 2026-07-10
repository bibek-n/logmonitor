import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query`SELECT Id, Name, Address, City, Country, Phone FROM BranchOffices ORDER BY Name ASC`;
  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const db = await getDb();
  await db
    .request()
    .input("name", sql.NVarChar, name)
    .input("address", sql.NVarChar, str(body?.address))
    .input("city", sql.NVarChar, str(body?.city))
    .input("country", sql.NVarChar, str(body?.country))
    .input("phone", sql.NVarChar, str(body?.phone))
    .query("INSERT INTO BranchOffices (Name, Address, City, Country, Phone) VALUES (@name, @address, @city, @country, @phone)");

  await logAdminAction({ admin, section: "organization", action: "create_branch_office", details: name, req });

  return NextResponse.json({ ok: true });
}
