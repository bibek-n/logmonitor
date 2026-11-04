import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireDbAnalyzerPermission, isDbAnalyzerSession } from "@/lib/requireDbAnalyzerPermission";
import { decryptSqlPassword } from "@/lib/sqlServerMonitoring/credentials";
import { testAiConfig } from "@/lib/dbAnalyzer/aiAnalysis";

interface StoredAiConfigRow {
  BaseUrl: string | null;
  ApiKeyEncrypted: string | null;
  Model: string | null;
}

// Tests either an unsaved draft (body.apiKey provided - lets the admin verify before Save) or
// whatever is already stored, so "Test" works both before and after the first save.
export async function POST(req: NextRequest) {
  const admin = await requireDbAnalyzerPermission("dba_ai_configure");
  if (!isDbAnalyzerSession(admin)) return admin;

  const body = await req.json().catch(() => ({}));

  let apiKey: string | null = typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : null;
  let baseUrl: string | null = typeof body.baseUrl === "string" && body.baseUrl.trim() ? body.baseUrl.trim() : null;
  let model: string | null = typeof body.model === "string" && body.model.trim() ? body.model.trim() : null;

  const db = await getDb();
  if (!apiKey || !baseUrl || !model) {
    const result = await db.query<StoredAiConfigRow>`SELECT BaseUrl, ApiKeyEncrypted, Model FROM DbAnalyzerAiConfig WHERE Id = 1`;
    const row = result.recordset[0];
    if (!apiKey) apiKey = row?.ApiKeyEncrypted ? decryptSqlPassword(row.ApiKeyEncrypted) : null;
    if (!baseUrl) baseUrl = row?.BaseUrl ?? null;
    if (!model) model = row?.Model ?? null;
  }

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "No API key saved or provided to test." }, { status: 400 });
  }

  const result = await testAiConfig({ baseUrl, apiKey, model: model || "gpt-4o-mini", mode: "non_ai" });

  await db
    .request()
    .input("success", sql.Bit, result.ok)
    .input("message", sql.NVarChar, result.message.slice(0, 500))
    .query(`UPDATE DbAnalyzerAiConfig SET LastTestAt = SYSUTCDATETIME(), LastTestSuccess = @success, LastTestMessage = @message WHERE Id = 1`);

  return NextResponse.json({ ok: result.ok, message: result.message });
}
