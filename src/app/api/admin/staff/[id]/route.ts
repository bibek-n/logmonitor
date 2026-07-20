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
  const { name, email, phone, address, computerName } = body ?? {};
  const departmentId = body?.departmentId == null || body.departmentId === "" ? null : Number(body.departmentId);
  const teamId = body?.teamId == null || body.teamId === "" ? null : Number(body.teamId);
  const branchOfficeId = body?.branchOfficeId == null || body.branchOfficeId === "" ? null : Number(body.branchOfficeId);
  const jobDesignationId = body?.jobDesignationId == null || body.jobDesignationId === "" ? null : Number(body.jobDesignationId);

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ ok: false, error: "Name is required." });
  }
  for (const [label, val] of [["departmentId", departmentId], ["teamId", teamId], ["branchOfficeId", branchOfficeId], ["jobDesignationId", jobDesignationId]] as const) {
    if (val !== null && (!Number.isInteger(val) || val <= 0)) {
      return NextResponse.json({ ok: false, error: `Invalid ${label}.` });
    }
  }

  const db = await getDb();
  try {
    // Department/Position stay in sync as plain text too - resolved from the picked
    // Department/JobDesignation row - so anything elsewhere in the app still reading
    // Staff.Department/Position as a raw string (reports, the staff list table, etc.)
    // keeps working without needing its own changes.
    const [deptNameResult, titleResult] = await Promise.all([
      departmentId
        ? db.request().input("id", sql.Int, departmentId).query<{ Name: string }>("SELECT Name FROM Departments WHERE Id = @id")
        : Promise.resolve({ recordset: [] as { Name: string }[] }),
      jobDesignationId
        ? db.request().input("id", sql.Int, jobDesignationId).query<{ Title: string }>("SELECT Title FROM JobDesignations WHERE Id = @id")
        : Promise.resolve({ recordset: [] as { Title: string }[] }),
    ]);
    const departmentName = deptNameResult.recordset[0]?.Name ?? null;
    const positionTitle = titleResult.recordset[0]?.Title ?? null;

    await db
      .request()
      .input("id", sql.Int, staffId)
      .input("name", sql.NVarChar, name.trim())
      .input("email", sql.NVarChar, typeof email === "string" && email.trim() ? email.trim() : null)
      .input("phone", sql.NVarChar, typeof phone === "string" && phone.trim() ? phone.trim() : null)
      .input("department", sql.NVarChar, departmentName)
      .input("position", sql.NVarChar, positionTitle)
      .input("address", sql.NVarChar, typeof address === "string" && address.trim() ? address.trim() : null)
      .input("departmentId", sql.Int, departmentId)
      .input("teamId", sql.Int, teamId)
      .input("branchOfficeId", sql.Int, branchOfficeId)
      .input("jobDesignationId", sql.Int, jobDesignationId)
      .input("computerNameOverride", sql.NVarChar, typeof computerName === "string" && computerName.trim() ? computerName.trim() : null)
      .query(`
        UPDATE Staff SET
          Name = @name, Email = @email, Phone = @phone, Department = @department,
          Position = @position, Address = @address, UpdatedAt = SYSUTCDATETIME(),
          DepartmentId = @departmentId, TeamId = @teamId, BranchOfficeId = @branchOfficeId,
          JobDesignationId = @jobDesignationId, ComputerNameOverride = @computerNameOverride
        WHERE Id = @id
      `);
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to save employee." });
  }

  return NextResponse.json({ ok: true });
}
