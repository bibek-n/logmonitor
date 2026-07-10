import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query`SELECT Id, Title, Description FROM JobDesignations ORDER BY Title ASC`;
  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });

  const db = await getDb();
  await db
    .request()
    .input("title", sql.NVarChar, title)
    .input("description", sql.NVarChar, typeof body?.description === "string" ? body.description.trim() || null : null)
    .query("INSERT INTO JobDesignations (Title, Description) VALUES (@title, @description)");

  await logAdminAction({ admin, section: "organization", action: "create_job_designation", details: title, req });

  return NextResponse.json({ ok: true });
}
