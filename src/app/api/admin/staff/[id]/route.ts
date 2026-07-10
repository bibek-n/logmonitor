import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const staffId = Number(id);
  if (!staffId) return NextResponse.json({ ok: false, error: "Invalid staff id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const { name, email, phone, department, position, address } = body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ ok: false, error: "Name is required." });
  }

  const db = await getDb();
  try {
    await db
      .request()
      .input("id", sql.Int, staffId)
      .input("name", sql.NVarChar, name.trim())
      .input("email", sql.NVarChar, typeof email === "string" && email.trim() ? email.trim() : null)
      .input("phone", sql.NVarChar, typeof phone === "string" && phone.trim() ? phone.trim() : null)
      .input("department", sql.NVarChar, typeof department === "string" && department.trim() ? department.trim() : null)
      .input("position", sql.NVarChar, typeof position === "string" && position.trim() ? position.trim() : null)
      .input("address", sql.NVarChar, typeof address === "string" && address.trim() ? address.trim() : null)
      .query(`
        UPDATE Staff SET
          Name = @name, Email = @email, Phone = @phone, Department = @department,
          Position = @position, Address = @address, UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @id
      `);
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to save employee." });
  }

  return NextResponse.json({ ok: true });
}
