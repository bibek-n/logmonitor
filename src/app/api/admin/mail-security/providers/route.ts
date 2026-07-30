import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";
import { createProviderConnectionSchema } from "@/lib/mailSecurity/schema";
import { encryptMailSecret } from "@/lib/mailSecurity/credentials";

export async function GET() {
  const mail = await requireMailPolicyPermission("mail_view");
  if (!isMailSession(mail)) return mail;

  const db = await getDb();
  // EncryptedSecret is intentionally never selected - connection secrets never round-trip
  // back to the admin UI once saved, same convention as every other credential field in
  // this app (e.g. SQL Server Monitoring instance passwords).
  const result = await db.query(`
    SELECT Id, ProviderType, DisplayName, Status, ConfigJson, LastTestedAt, LastTestResult, IsActive,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt, CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM MailProviderConnections
    ORDER BY DisplayName ASC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const mail = await requireMailPolicyPermission("mail_manage_connectors");
  if (!isMailSession(mail)) return mail;

  const body = await req.json().catch(() => null);
  const parsed = createProviderConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid provider connection payload" }, { status: 400 });
  }
  const p = parsed.data;

  const db = await getDb();
  const inserted = await db
    .request()
    .input("providerType", sql.VarChar, p.providerType)
    .input("displayName", sql.NVarChar, p.displayName)
    .input("configJson", sql.NVarChar(sql.MAX), JSON.stringify(p.config))
    .input("encryptedSecret", sql.NVarChar, p.secret ? encryptMailSecret(p.secret) : null)
    .input("createdByUserId", sql.Int, mail.userId)
    .query<{ Id: number }>(`
      INSERT INTO MailProviderConnections (ProviderType, DisplayName, ConfigJson, EncryptedSecret, CreatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@providerType, @displayName, @configJson, @encryptedSecret, @createdByUserId)
    `);

  await logAdminAction({ admin: mail, section: "mail-security", action: "provider_create", details: `${p.providerType}: ${p.displayName}`, req });

  return NextResponse.json({
    ok: true,
    data: { id: inserted.recordset[0].Id },
    note: `${p.providerType} adapter is not implemented yet - this connection is saved but will report "not connected" until Stage 2 wires up a real adapter for it.`,
  });
}
