import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";
import { createProviderAdapter } from "@/lib/mailSecurity/providers/stubAdapter";
import { ProviderType } from "@/lib/mailSecurity/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_manage_connectors");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, Number(id))
    .query<{ ProviderType: ProviderType; DisplayName: string; ConfigJson: string | null }>(
      "SELECT ProviderType, DisplayName, ConfigJson FROM MailProviderConnections WHERE Id = @id"
    );
  const row = result.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "Provider connection not found" }, { status: 404 });

  // Genuinely calls the real (stub) adapter's testConnection() - the result is a real,
  // honest "not connected yet" rather than a hardcoded UI string, so the connector-test UX
  // behaves correctly once Stage 2 swaps the stub for a real adapter.
  const adapter = createProviderAdapter({
    providerType: row.ProviderType,
    displayName: row.DisplayName,
    config: row.ConfigJson ? JSON.parse(row.ConfigJson) : {},
    secret: null,
  });
  const testResult = await adapter.testConnection();

  await db
    .request()
    .input("id", sql.Int, Number(id))
    .input("status", sql.VarChar, testResult.ok ? "Connected" : "Error")
    .input("lastTestResult", sql.NVarChar, testResult.message)
    .query("UPDATE MailProviderConnections SET Status = @status, LastTestedAt = SYSUTCDATETIME(), LastTestResult = @lastTestResult WHERE Id = @id");

  await logAdminAction({ admin: mail, section: "mail-security", action: "provider_test", details: row.DisplayName, req });

  return NextResponse.json({ ok: true, data: testResult });
}
