import { getDb } from "@/lib/db";
import { decryptSqlPassword } from "@/lib/sqlServerMonitoring/credentials";
import type { AnalysisMode } from "./types";

export interface DbAnalyzerAiConfig {
  baseUrl: string | null;
  apiKey: string;
  model: string;
  mode: AnalysisMode;
}

interface AiConfigRow {
  BaseUrl: string | null;
  ApiKeyEncrypted: string | null;
  Model: string | null;
  Mode: AnalysisMode;
  Enabled: boolean;
}

// Returns null whenever AI analysis can't run (disabled, or no key saved yet) - callers treat
// that as "fall back to non_ai", the one mode that always works with zero configuration.
export async function getDbAnalyzerAiConfig(): Promise<DbAnalyzerAiConfig | null> {
  const db = await getDb();
  const result = await db.query<AiConfigRow>`
    SELECT BaseUrl, ApiKeyEncrypted, Model, Mode, Enabled FROM DbAnalyzerAiConfig WHERE Id = 1
  `;
  const row = result.recordset[0];
  if (!row || !row.Enabled || !row.ApiKeyEncrypted) return null;

  return {
    baseUrl: row.BaseUrl,
    apiKey: decryptSqlPassword(row.ApiKeyEncrypted),
    model: row.Model || "gpt-4o-mini",
    mode: row.Mode,
  };
}
