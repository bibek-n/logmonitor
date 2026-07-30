import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { TOOL_DEFINITIONS, TOOL_HANDLERS, type ToolResult } from "./tools";

// GitHub Models (https://github.com/marketplace/models) exposes an OpenAI-compatible
// chat.completions API, authenticated with a GitHub personal access token rather than an
// Anthropic key - free tier, rate-limited, positioned by GitHub for prototypes/demos rather
// than production, but that's an accepted tradeoff for this feature rather than a blocker.
const GITHUB_MODELS_BASE_URL = "https://models.github.ai/inference";
const GITHUB_TOKEN = process.env.GITHUB_MODELS_TOKEN;
// GitHub Models catalog IDs are "<publisher>/<model>" - overridable in case the exact catalog
// string ever changes without needing a code change. "openai/gpt-5" is listed in the catalog
// but returns "Unavailable model" for this account's token (likely a tier/access restriction
// on GitHub's side, confirmed live) - gpt-4o is the one actually usable on the free tier.
const MODEL = process.env.AI_ASSISTANT_MODEL || "openai/gpt-4o";
const MAX_TOOL_ROUNDS = 4;

const SYSTEM_PROMPT = `You are the AI Assistant inside Tulips Unified Admin Center, an IT/network monitoring dashboard.
Answer the admin's question using ONLY the provided tools - never guess or make up numbers, device names, or dates.
If a tool returns no data relevant to the question, say so plainly rather than inventing an answer.
Keep answers concise and factual (a few sentences, or a short list) - this is read by a busy admin, not a report.
When a question needs a "why" (e.g. why bandwidth is high), use the tool's returned data (baseline vs recent, top consumers) to give a specific, grounded explanation rather than a generic one.`;

export interface AssistantResponse {
  answer: string;
  toolsUsed: ToolResult[];
}

export function isAiAssistantConfigured(): boolean {
  return !!GITHUB_TOKEN;
}

async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  const handler = TOOL_HANDLERS[name];
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  return handler(input);
}

// A single question, answered in isolation (no multi-turn conversation memory - see
// migrate-ai-assistant.ts's comment on why this app treats each question as independent rather
// than a chat thread). Loops through the model's tool-call rounds itself: it calls one or more
// tools, gets results back, and either calls more tools or produces a final text answer -
// bounded by MAX_TOOL_ROUNDS so a model stuck in a tool-call loop can't run away.
export async function askAiAssistant(question: string): Promise<AssistantResponse> {
  if (!GITHUB_TOKEN) {
    throw new Error("AI Assistant is not configured on this server - GITHUB_MODELS_TOKEN is not set.");
  }

  const client = new OpenAI({ baseURL: GITHUB_MODELS_BASE_URL, apiKey: GITHUB_TOKEN });
  const toolsUsed: ToolResult[] = [];
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: question },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      tools: TOOL_DEFINITIONS,
      messages,
    });

    const choice = response.choices[0];
    const toolCalls = choice.message.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      return { answer: choice.message.content ?? "I couldn't come up with an answer to that.", toolsUsed };
    }

    messages.push(choice.message);

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(call.function.arguments || "{}");
      } catch {
        // Malformed arguments from the model - fed back as a tool error below rather than
        // thrown, so the model gets a chance to retry with valid JSON.
      }
      try {
        const output = await runTool(call.function.name, input);
        toolsUsed.push({ toolName: call.function.name, input, output });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(output) });
      } catch (err) {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: `Error: ${err instanceof Error ? err.message : "tool failed"}`,
        });
      }
    }
  }

  return { answer: "I wasn't able to finish gathering the data needed to answer that - try rephrasing or narrowing the question.", toolsUsed };
}
