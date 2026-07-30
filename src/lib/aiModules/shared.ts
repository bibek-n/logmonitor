import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Shared tool-calling runner for the 6 AI Modules (Root Cause Analysis, Alert Correlation, AI
// Incident Summary, AI Log Analyzer, AI Configuration Review, AI Threat Detection). Deliberately
// a separate copy of the loop in src/lib/aiAssistant/assistant.ts rather than a refactor of that
// file - same GitHub Models setup, same tool-calling shape, but kept independent so the two
// features can't accidentally couple/break each other.
const GITHUB_MODELS_BASE_URL = "https://models.github.ai/inference";
const GITHUB_TOKEN = process.env.GITHUB_MODELS_TOKEN;
const MODEL = process.env.AI_ASSISTANT_MODEL || "openai/gpt-4o";
const MAX_TOOL_ROUNDS = 4;

export function isAiModulesConfigured(): boolean {
  return !!GITHUB_TOKEN;
}

export interface ToolResult {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
}

export interface ModuleResponse {
  answer: string;
  toolsUsed: ToolResult[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolHandler = (input: any) => Promise<unknown>;

export async function runAiModuleChat(
  systemPrompt: string,
  question: string,
  toolDefinitions: OpenAI.Chat.ChatCompletionTool[],
  toolHandlers: Record<string, ToolHandler>
): Promise<ModuleResponse> {
  if (!GITHUB_TOKEN) {
    throw new Error("This AI module is not configured on this server - GITHUB_MODELS_TOKEN is not set.");
  }

  const client = new OpenAI({ baseURL: GITHUB_MODELS_BASE_URL, apiKey: GITHUB_TOKEN });
  const toolsUsed: ToolResult[] = [];
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      tools: toolDefinitions,
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
      const handler = toolHandlers[call.function.name];
      try {
        if (!handler) throw new Error(`Unknown tool: ${call.function.name}`);
        const output = await handler(input);
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
