import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query`SELECT Id, [Key], Subject, Body, IsSystem FROM NotificationTemplates ORDER BY [Key] ASC`;
  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!key) return NextResponse.json({ ok: false, error: "Key is required." }, { status: 400 });

  const db = await getDb();
  const existing = await db.request().input("key", sql.NVarChar, key).query("SELECT Id FROM NotificationTemplates WHERE [Key] = @key");
  if (existing.recordset.length > 0) {
    return NextResponse.json({ ok: false, error: "A template with that key already exists." }, { status: 409 });
  }

  await db
    .request()
    .input("key", sql.NVarChar, key)
    .input("subject", sql.NVarChar, typeof body?.subject === "string" ? body.subject : null)
    .input("body", sql.NVarChar, typeof body?.body === "string" ? body.body : null)
    .query("INSERT INTO NotificationTemplates ([Key], Subject, Body, IsSystem) VALUES (@key, @subject, @body, 0)");

  await logAdminAction({ admin, section: "notifications", action: "create_template", details: key, req });

  return NextResponse.json({ ok: true });
}
