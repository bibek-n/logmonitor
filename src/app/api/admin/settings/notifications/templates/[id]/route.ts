import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const templateId = Number(id);
  const body = await req.json().catch(() => null);
  if (!Number.isInteger(templateId) || !body) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, templateId)
    .input("subject", sql.NVarChar, typeof body.subject === "string" ? body.subject : null)
    .input("body", sql.NVarChar, typeof body.body === "string" ? body.body : null)
    .query("UPDATE NotificationTemplates SET Subject = @subject, Body = @body, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin, section: "notifications", action: "update_template", details: `id=${templateId}`, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const templateId = Number(id);
  if (!Number.isInteger(templateId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, templateId).query<{ IsSystem: boolean }>("SELECT IsSystem FROM NotificationTemplates WHERE Id = @id");
  if (existing.recordset[0]?.IsSystem) {
    return NextResponse.json({ ok: false, error: "Built-in templates cannot be deleted." }, { status: 400 });
  }

  await db.request().input("id", sql.Int, templateId).query("DELETE FROM NotificationTemplates WHERE Id = @id");

  await logAdminAction({ admin, section: "notifications", action: "delete_template", details: `id=${templateId}`, req });

  return NextResponse.json({ ok: true });
}
