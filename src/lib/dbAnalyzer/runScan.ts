import { getDb, sql } from "@/lib/db";
import { decryptSqlPassword } from "@/lib/sqlServerMonitoring/credentials";
import { introspectSchema } from "./connectors";
import { parseDdlToSchema } from "./ddlParser";
import { runStructureRules } from "./rules/structureRules";
import { runSecurityRules } from "./rules/securityRules";
import { runSensitiveDataRules } from "./rules/sensitiveDataRules";
import { runAiFindings, runAiSummary } from "./aiAnalysis";
import { getDbAnalyzerAiConfig } from "./aiConfig";
import { computeSecurityScore, riskLevelForScore } from "./scoring";
import type { AnalysisMode, ConnectionConfig, ConnectionSource, DbEngine, Finding, ScanSummary } from "./types";

interface ConnectionRow {
  Id: number;
  Engine: DbEngine;
  Source: ConnectionSource;
  HostName: string | null;
  Port: number | null;
  DatabaseName: string | null;
  Username: string | null;
  PasswordEncrypted: string | null;
  UploadedSqlText: string | null;
}

export async function runScan(connectionId: number, triggeredByUserId: number, triggeredBy: string): Promise<ScanSummary> {
  const db = await getDb();

  const connResult = await db
    .request()
    .input("id", sql.Int, connectionId)
    .query<ConnectionRow>(
      "SELECT Id, Engine, Source, HostName, Port, DatabaseName, Username, PasswordEncrypted, UploadedSqlText FROM DbAnalyzerConnections WHERE Id = @id"
    );
  const connRow = connResult.recordset[0];
  if (!connRow) throw new Error("Connection not found.");

  // "live" decrypts stored credentials and introspects over the network, same as Phase 1.
  // "upload" has no connection at all - config stays null (securityRules skips the
  // privileged-username check accordingly) and the schema comes from parsing the stored
  // .sql text instead of a live round trip.
  let config: ConnectionConfig | null = null;
  if (connRow.Source === "upload") {
    if (!connRow.UploadedSqlText) throw new Error("No SQL file content stored for this connection.");
  } else {
    config = {
      engine: connRow.Engine,
      host: connRow.HostName ?? "",
      port: connRow.Port ?? 0,
      database: connRow.DatabaseName ?? "",
      username: connRow.Username ?? "",
      password: connRow.PasswordEncrypted ? decryptSqlPassword(connRow.PasswordEncrypted) : "",
    };
  }

  const aiConfig = await getDbAnalyzerAiConfig();
  const mode: AnalysisMode = aiConfig?.mode ?? "non_ai";

  const scanInsert = await db
    .request()
    .input("connectionId", sql.Int, connectionId)
    .input("triggeredByUserId", sql.Int, triggeredByUserId)
    .input("triggeredBy", sql.NVarChar, triggeredBy)
    .input("mode", sql.VarChar, mode)
    .query<{ Id: number }>(`
      INSERT INTO DbAnalyzerScans (ConnectionId, Status, StartedAt, TriggeredByUserId, TriggeredBy, AnalysisMode)
      OUTPUT INSERTED.Id
      VALUES (@connectionId, 'Running', SYSUTCDATETIME(), @triggeredByUserId, @triggeredBy, @mode)
    `);
  const scanId = scanInsert.recordset[0].Id;

  try {
    const schema =
      connRow.Source === "upload" ? parseDdlToSchema(connRow.UploadedSqlText!, connRow.Engine) : await introspectSchema(config!);

    // "ai" mode skips the deterministic rule engine entirely (the model reviews the schema on
    // its own); "non_ai" and "hybrid" always run it, since hybrid's whole point is combining
    // both. Each rule-engine finding is tagged "rule" so the UI/export can show provenance.
    const ruleFindings: Finding[] =
      mode === "ai"
        ? []
        : [...runStructureRules(schema), ...runSecurityRules(schema, config), ...runSensitiveDataRules(schema)].map((f) => ({
            ...f,
            source: "rule" as const,
          }));

    let aiFindings: Finding[] = [];
    let aiSummary: string | null = null;
    let aiError: string | null = null;

    if ((mode === "ai" || mode === "hybrid") && aiConfig) {
      const aiResult = await runAiFindings(schema, aiConfig);
      aiFindings = aiResult.findings;
      if (aiResult.error) aiError = aiResult.error;

      const summaryResult = await runAiSummary(schema, [...ruleFindings, ...aiFindings], aiConfig);
      aiSummary = summaryResult.summary;
      if (summaryResult.error && !aiError) aiError = summaryResult.error;
    }

    const findings: Finding[] = [...ruleFindings, ...aiFindings];
    const securityScore = computeSecurityScore(findings);
    const riskLevel = riskLevelForScore(securityScore);

    for (const f of findings) {
      await db
        .request()
        .input("scanId", sql.Int, scanId)
        .input("connectionId", sql.Int, connectionId)
        .input("category", sql.VarChar, f.category)
        .input("severity", sql.VarChar, f.severity)
        .input("title", sql.NVarChar, f.title)
        .input("detail", sql.NVarChar, f.detail ?? null)
        .input("evidence", sql.NVarChar, f.evidence ?? null)
        .input("affectedObject", sql.NVarChar, f.affectedObject ?? null)
        .input("recommendation", sql.NVarChar, f.recommendation ?? null)
        .input("source", sql.VarChar, f.source ?? "rule")
        .query(`
          INSERT INTO DbAnalyzerFindings (ScanId, ConnectionId, Category, Severity, Title, Detail, Evidence, AffectedObject, Recommendation, Source)
          VALUES (@scanId, @connectionId, @category, @severity, @title, @detail, @evidence, @affectedObject, @recommendation, @source)
        `);
    }

    await db
      .request()
      .input("scanId", sql.Int, scanId)
      .input("tableCount", sql.Int, schema.tables.length)
      .input("findingCount", sql.Int, findings.length)
      .input("securityScore", sql.Int, securityScore)
      .input("riskLevel", sql.VarChar, riskLevel)
      .input("serverVersion", sql.NVarChar, schema.serverVersion)
      .input("schemaJson", sql.NVarChar, JSON.stringify(schema))
      .input("aiSummary", sql.NVarChar, aiSummary)
      .input("aiError", sql.NVarChar, aiError)
      .query(`
        UPDATE DbAnalyzerScans SET
          Status = 'Completed', CompletedAt = SYSUTCDATETIME(), TableCount = @tableCount,
          FindingCount = @findingCount, SecurityScore = @securityScore, RiskLevel = @riskLevel,
          ServerVersion = @serverVersion, SchemaJson = @schemaJson, AiSummary = @aiSummary, AiError = @aiError
        WHERE Id = @scanId
      `);

    return { scanId, tableCount: schema.tables.length, findingCount: findings.length, securityScore, riskLevel };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .request()
      .input("scanId", sql.Int, scanId)
      .input("errorMessage", sql.NVarChar, message)
      .query("UPDATE DbAnalyzerScans SET Status = 'Failed', CompletedAt = SYSUTCDATETIME(), ErrorMessage = @errorMessage WHERE Id = @scanId");
    throw err;
  }
}
