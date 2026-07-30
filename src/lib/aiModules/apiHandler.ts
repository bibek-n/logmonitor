import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { runAiModuleChat, isAiModulesConfigured } from "./shared";
import { getAiModule } from "./modules";

const MAX_QUESTION_LENGTH = 500;

// Shared POST handler body for all 6 AI Modules' /ask routes - each route.ts is a thin wrapper
// calling this with its module key, same as the per-route logic in
// src/app/api/admin/ai-assistant/ask/route.ts but parameterized instead of copy-pasted 6 times.
export async function handleAiModuleAsk(req: NextRequest, moduleKey: string) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const module = getAiModule(moduleKey);
  if (!module) {
    return NextResponse.json({ ok: false, error: "Unknown AI module." }, { status: 500 });
  }

  if (!isAiModulesConfigured()) {
    return NextResponse.json(
      { ok: false, error: "This AI module is not configured on this server yet - an administrator needs to set GITHUB_MODELS_TOKEN." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ ok: false, error: "question is required" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ ok: false, error: `Question is too long (max ${MAX_QUESTION_LENGTH} characters).` }, { status: 400 });
  }

  const db = await getDb();

  try {
    const { answer, toolsUsed } = await runAiModuleChat(module.systemPrompt, question, module.toolDefinitions, module.toolHandlers);

    await db
      .request()
      .input("moduleKey", sql.NVarChar, moduleKey)
      .input("userId", sql.Int, admin.userId)
      .input("username", sql.NVarChar, admin.username)
      .input("question", sql.NVarChar, question)
      .input("answer", sql.NVarChar, answer)
      .input("toolsUsedJson", sql.NVarChar, JSON.stringify(toolsUsed))
      .query(`
        INSERT INTO AiModuleQueries (ModuleKey, UserId, Username, Question, Answer, ToolsUsedJson)
        VALUES (@moduleKey, @userId, @username, @question, @answer, @toolsUsedJson)
      `);

    return NextResponse.json({ ok: true, answer, toolsUsed: toolsUsed.map((t) => t.toolName) });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Something went wrong.";

    await db
      .request()
      .input("moduleKey", sql.NVarChar, moduleKey)
      .input("userId", sql.Int, admin.userId)
      .input("username", sql.NVarChar, admin.username)
      .input("question", sql.NVarChar, question)
      .input("errorMessage", sql.NVarChar, errorMessage)
      .query("INSERT INTO AiModuleQueries (ModuleKey, UserId, Username, Question, ErrorMessage) VALUES (@moduleKey, @userId, @username, @question, @errorMessage)");

    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}
