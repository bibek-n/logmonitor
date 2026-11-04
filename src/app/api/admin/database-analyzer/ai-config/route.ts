import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireDbAnalyzerPermission, isDbAnalyzerSession } from "@/lib/requireDbAnalyzerPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { encryptSqlPassword } from "@/lib/sqlServerMonitoring/credentials";
import type { AnalysisMode } from "@/lib/dbAnalyzer/types";

const VALID_MODES: AnalysisMode[] = ["non_ai", "ai", "hybrid"];

// GET is gated at dba_view (same as the rest of the module) so anyone who can see the module
// can see which mode is active - the API key itself is never returned, only ApiKeySet.
export async function GET() {
  const admin = await requireDbAnalyzerPermission("dba_view");
  if (!isDbAnalyzerSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query`
    SELECT Provider, BaseUrl, Model, Mode, Enabled,
      CASE WHEN ApiKeyEncrypted IS NOT NULL AND ApiKeyEncrypted <> '' THEN 1 ELSE 0 END AS ApiKeySet,
      CONVERT(VARCHAR(19), LastTestAt, 126) AS LastTestAt, LastTestSuccess, LastTestMessage
    FROM DbAnalyzerAiConfig WHERE Id = 1
  `;
  return NextResponse.json({ ok: true, data: result.recordset[0] ?? null });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireDbAnalyzerPermission("dba_ai_configure");
  if (!isDbAnalyzerSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  const mode = VALID_MODES.includes(body.mode) ? body.mode : "non_ai";
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const apiKey = typeof body.apiKey === "string" && body.apiKey.trim() ? encryptSqlPassword(body.apiKey.trim()) : null;

  const db = await getDb();
  await db
    .request()
    .input("provider", sql.NVarChar, str(body.provider))
    .input("baseUrl", sql.NVarChar, str(body.baseUrl))
    .input("apiKey", sql.NVarChar, apiKey)
    .input("model", sql.NVarChar, str(body.model) ?? "gpt-4o-mini")
    .input("mode", sql.VarChar, mode)
    .input("enabled", sql.Bit, body.enabled === true)
    .input("updatedByUserId", sql.Int, admin.userId)
    .query(`
      UPDATE DbAnalyzerAiConfig SET
        Provider = @provider, BaseUrl = @baseUrl,
        ApiKeyEncrypted = COALESCE(@apiKey, ApiKeyEncrypted),
        Model = @model, Mode = @mode, Enabled = @enabled,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
      WHERE Id = 1
    `);

  await logAdminAction({ admin, section: "database_analyzer", action: "update_ai_config", details: `mode=${mode} enabled=${body.enabled === true}`, req });

  return NextResponse.json({ ok: true });
}
