import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { requireLaravelSecurityPermission, isLsSession } from "@/lib/requireLaravelSecurityPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { issueSeveritySchema } from "@/lib/laravelSecurityShared";

export async function GET() {
  const ls = await requireLaravelSecurityPermission("ls_view");
  if (!isLsSession(ls)) return ls;

  const db = await getDb();
  const rules = await db.query`
    SELECT Id, RuleCode, RuleName, Description, Category, DefaultSeverity, Enabled, Configuration
    FROM LaravelSecurityRules ORDER BY Category, RuleName
  `;

  return NextResponse.json({ ok: true, data: rules.recordset });
}

const updateRulesSchema = z.object({
  rules: z
    .array(
      z.object({
        id: z.number().int().positive(),
        enabled: z.boolean().optional(),
        defaultSeverity: issueSeveritySchema.optional(),
      })
    )
    .min(1)
    .max(500),
});

// Bulk update so the Rules & Settings page can save its whole table with one Save button
// instead of one request per toggled rule - same pattern as codeQuality's rules/route.ts.
export async function PATCH(req: NextRequest) {
  const ls = await requireLaravelSecurityPermission("ls_settings_manage");
  if (!isLsSession(ls)) return ls;

  const body = await req.json().catch(() => null);
  const parsed = updateRulesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request body." }, { status: 400 });
  }

  const db = await getDb();
  for (const rule of parsed.data.rules) {
    const setClauses: string[] = ["UpdatedAt = SYSUTCDATETIME()"];
    const request = db.request().input("id", sql.Int, rule.id);
    if (rule.enabled !== undefined) { setClauses.push("Enabled = @enabled"); request.input("enabled", sql.Bit, rule.enabled); }
    if (rule.defaultSeverity !== undefined) { setClauses.push("DefaultSeverity = @severity"); request.input("severity", sql.VarChar, rule.defaultSeverity); }
    if (setClauses.length === 1) continue;
    await request.query(`UPDATE LaravelSecurityRules SET ${setClauses.join(", ")} WHERE Id = @id`);
  }

  await logAdminAction({ admin: ls, section: "laravel-security", action: "update_rules", details: `${parsed.data.rules.length} rule(s) updated`, req });
  return NextResponse.json({ ok: true });
}
