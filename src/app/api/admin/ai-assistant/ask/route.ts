import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { askAiAssistant, isAiAssistantConfigured } from "@/lib/aiAssistant/assistant";

const MAX_QUESTION_LENGTH = 500;

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  if (!isAiAssistantConfigured()) {
    return NextResponse.json(
      { ok: false, error: "AI Assistant is not configured on this server yet - an administrator needs to set GITHUB_MODELS_TOKEN." },
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
    const { answer, toolsUsed } = await askAiAssistant(question);

    await db
      .request()
      .input("userId", sql.Int, admin.userId)
      .input("username", sql.NVarChar, admin.username)
      .input("question", sql.NVarChar, question)
      .input("answer", sql.NVarChar, answer)
      .input("toolsUsedJson", sql.NVarChar, JSON.stringify(toolsUsed))
      .query(`
        INSERT INTO AiAssistantQueries (UserId, Username, Question, Answer, ToolsUsedJson)
        VALUES (@userId, @username, @question, @answer, @toolsUsedJson)
      `);

    return NextResponse.json({ ok: true, answer, toolsUsed: toolsUsed.map((t) => t.toolName) });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Something went wrong.";

    await db
      .request()
      .input("userId", sql.Int, admin.userId)
      .input("username", sql.NVarChar, admin.username)
      .input("question", sql.NVarChar, question)
      .input("errorMessage", sql.NVarChar, errorMessage)
      .query("INSERT INTO AiAssistantQueries (UserId, Username, Question, ErrorMessage) VALUES (@userId, @username, @question, @errorMessage)");

    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}
