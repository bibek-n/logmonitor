import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query`
    SELECT u.Id, u.Username, u.FullName, u.Email, u.Role, u.IsActive, u.MfaRequired, u.CreatedAt,
      u.DepartmentId, d.Name AS DepartmentName,
      u.TeamId, t.Name AS TeamName,
      u.BranchOfficeId, b.Name AS BranchOfficeName,
      u.JobDesignationId, j.Title AS JobDesignationTitle
    FROM Users u
    LEFT JOIN Departments d ON d.Id = u.DepartmentId
    LEFT JOIN Teams t ON t.Id = u.TeamId
    LEFT JOIN BranchOffices b ON b.Id = u.BranchOfficeId
    LEFT JOIN JobDesignations j ON j.Id = u.JobDesignationId
    ORDER BY u.Username ASC
  `;
  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || password.length < 8) {
    return NextResponse.json({ ok: false, error: "Username is required and password must be at least 8 characters." }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.request().input("username", sql.NVarChar, username).query("SELECT Id FROM Users WHERE Username = @username");
  if (existing.recordset.length > 0) {
    return NextResponse.json({ ok: false, error: "That username is already taken." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const int = (v: unknown) => (Number.isInteger(v) ? v : null);

  await db
    .request()
    .input("username", sql.NVarChar, username)
    .input("passwordHash", sql.NVarChar, passwordHash)
    .input("fullName", sql.NVarChar, str(body?.fullName))
    .input("email", sql.NVarChar, str(body?.email))
    .input("departmentId", sql.Int, int(body?.departmentId))
    .input("teamId", sql.Int, int(body?.teamId))
    .input("branchOfficeId", sql.Int, int(body?.branchOfficeId))
    .input("jobDesignationId", sql.Int, int(body?.jobDesignationId))
    .query(`
      INSERT INTO Users (Username, PasswordHash, Role, FullName, Email, DepartmentId, TeamId, BranchOfficeId, JobDesignationId, IsActive)
      VALUES (@username, @passwordHash, 'Employee', @fullName, @email, @departmentId, @teamId, @branchOfficeId, @jobDesignationId, 1)
    `);

  await logAdminAction({ admin, section: "users_access", action: "create_user", details: username, req });

  return NextResponse.json({ ok: true });
}
