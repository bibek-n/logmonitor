import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";
import { updateProviderConnectionSchema } from "@/lib/mailSecurity/schema";
import { encryptMailSecret } from "@/lib/mailSecurity/credentials";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_manage_connectors");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateProviderConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid provider connection payload" }, { status: 400 });
  }
  const p = parsed.data;

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, Number(id)).query<{ DisplayName: string }>("SELECT DisplayName FROM MailProviderConnections WHERE Id = @id");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Provider connection not found" }, { status: 404 });

  const request = db
    .request()
    .input("id", sql.Int, Number(id))
    .input("displayName", sql.NVarChar, p.displayName ?? existing.recordset[0].DisplayName);
  const setClauses = ["DisplayName = @displayName", "UpdatedAt = SYSUTCDATETIME()"];

  if (p.providerType) {
    request.input("providerType", sql.VarChar, p.providerType);
    setClauses.push("ProviderType = @providerType");
  }
  if (p.config) {
    request.input("configJson", sql.NVarChar(sql.MAX), JSON.stringify(p.config));
    setClauses.push("ConfigJson = @configJson");
  }
  if (p.secret) {
    request.input("encryptedSecret", sql.NVarChar, encryptMailSecret(p.secret));
    setClauses.push("EncryptedSecret = @encryptedSecret");
  }

  await request.query(`UPDATE MailProviderConnections SET ${setClauses.join(", ")} WHERE Id = @id`);

  await logAdminAction({ admin: mail, section: "mail-security", action: "provider_update", details: existing.recordset[0].DisplayName, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_manage_connectors");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, Number(id)).query<{ DisplayName: string }>("SELECT DisplayName FROM MailProviderConnections WHERE Id = @id");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Provider connection not found" }, { status: 404 });

  await db.request().input("id", sql.Int, Number(id)).query("UPDATE MailProviderConnections SET IsActive = 0 WHERE Id = @id");

  await logAdminAction({ admin: mail, section: "mail-security", action: "provider_delete", details: existing.recordset[0].DisplayName, req });

  return NextResponse.json({ ok: true });
}
