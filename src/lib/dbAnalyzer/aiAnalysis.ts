import OpenAI from "openai";
import type { DbAnalyzerAiConfig } from "./aiConfig";
import type { Finding, FindingCategory, SchemaSnapshot, Severity } from "./types";

// Separate AI integration, deliberately not sharing code or env vars with src/lib/aiModules or
// src/lib/aiAssistant - this module's config (provider/base URL/key/model) is admin-configured
// per DbAnalyzerAiConfig, not a GITHUB_MODELS_TOKEN env var, so a customer can point it at
// their own OpenAI-compatible endpoint without touching this app's other AI features.
const VALID_SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];
const VALID_CATEGORIES: FindingCategory[] = ["structure", "security", "sensitive-data"];
const AI_TIMEOUT_MS = 30_000;
const MAX_AI_FINDINGS = 20;

function client(config: DbAnalyzerAiConfig): OpenAI {
  return new OpenAI({ baseURL: config.baseUrl || undefined, apiKey: config.apiKey });
}

// Only names/types/keys/indexes ever leave this process - the same "schema metadata only,
// never row data" boundary every other part of this module holds to.
function buildSchemaDigest(schema: SchemaSnapshot): string {
  if (schema.tables.length === 0) return "(no tables found)";
  return schema.tables
    .map((t) => {
      const cols = t.columns
        .map((c) => `${c.name}:${c.dataType}${c.isPrimaryKey ? " PK" : ""}${c.isForeignKey ? " FK" : ""}${c.nullable ? "" : " NOT NULL"}`)
        .join(", ");
      const idx = t.indexes.length ? ` | indexes: ${t.indexes.map((i) => i.name).join(", ")}` : "";
      return `TABLE ${t.name} (${cols})${idx}`;
    })
    .join("\n");
}

const FINDINGS_SYSTEM_PROMPT = `You are a database security and schema design reviewer. You are given only table/column
schema metadata (names, types, keys, indexes) - never row data, never actual stored values.
Identify structural, security, and sensitive-data-exposure issues purely from this metadata.

Respond with ONLY a JSON object of this exact shape, no prose, no markdown fencing:
{"findings":[{"category":"structure|security|sensitive-data","severity":"critical|high|medium|low|info","title":"...","detail":"...","affectedObject":"table.column or table","recommendation":"..."}]}

Keep findings specific, non-redundant, and grounded only in what the schema metadata shows.
Return at most 20 findings. Return {"findings":[]} if you find nothing worth flagging.`;

export async function runAiFindings(
  schema: SchemaSnapshot,
  config: DbAnalyzerAiConfig
): Promise<{ findings: Finding[]; error?: string }> {
  try {
    const response = await client(config).chat.completions.create(
      {
        model: config.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: FINDINGS_SYSTEM_PROMPT },
          { role: "user", content: buildSchemaDigest(schema) },
        ],
      },
      { timeout: AI_TIMEOUT_MS }
    );

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed: unknown = JSON.parse(content);
    const rawFindings =
      parsed && typeof parsed === "object" && Array.isArray((parsed as { findings?: unknown }).findings)
        ? (parsed as { findings: unknown[] }).findings
        : [];

    const findings: Finding[] = rawFindings
      .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
      .slice(0, MAX_AI_FINDINGS)
      .map((f) => ({
        category: VALID_CATEGORIES.includes(f.category as FindingCategory) ? (f.category as FindingCategory) : "structure",
        severity: VALID_SEVERITIES.includes(f.severity as Severity) ? (f.severity as Severity) : "info",
        title: typeof f.title === "string" && f.title.trim() ? f.title.slice(0, 500) : "AI-identified issue",
        detail: typeof f.detail === "string" ? f.detail.slice(0, 2000) : undefined,
        affectedObject: typeof f.affectedObject === "string" ? f.affectedObject.slice(0, 500) : undefined,
        recommendation: typeof f.recommendation === "string" ? f.recommendation.slice(0, 1000) : undefined,
        source: "ai" as const,
      }));

    return { findings };
  } catch (err) {
    return { findings: [], error: err instanceof Error ? err.message : "AI analysis failed." };
  }
}

export async function runAiSummary(
  schema: SchemaSnapshot,
  findings: Finding[],
  config: DbAnalyzerAiConfig
): Promise<{ summary: string | null; error?: string }> {
  try {
    const findingsDigest = findings.map((f) => `[${f.severity}] ${f.category}: ${f.title}`).join("\n") || "(no findings)";
    const response = await client(config).chat.completions.create(
      {
        model: config.model,
        messages: [
          {
            role: "system",
            content:
              "You are a database security reviewer. Given a scanned schema's findings, write a short (3-6 sentence) " +
              "plain-language risk summary for a non-technical stakeholder. Plain prose only, no markdown, no bullet points.",
          },
          { role: "user", content: `Database has ${schema.tables.length} table(s).\n\nFindings:\n${findingsDigest}` },
        ],
      },
      { timeout: AI_TIMEOUT_MS }
    );
    const summary = response.choices[0]?.message?.content?.trim();
    return { summary: summary || null };
  } catch (err) {
    return { summary: null, error: err instanceof Error ? err.message : "AI summary generation failed." };
  }
}

export async function testAiConfig(config: DbAnalyzerAiConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await client(config).chat.completions.create(
      {
        model: config.model,
        messages: [{ role: "user", content: 'Reply with exactly one word: "OK".' }],
      },
      { timeout: 15_000 }
    );
    const content = response.choices[0]?.message?.content?.trim() ?? "";
    return { ok: true, message: `Connected - model responded: "${content.slice(0, 100)}"` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed." };
  }
}
