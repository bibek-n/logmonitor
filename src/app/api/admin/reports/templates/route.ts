import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  try {
    const db = await getDb();
    const result = await db
      .request()
      .input("userId", sql.Int, admin.userId)
      .query<{ Id: number; Name: string; SourceKey: string; SelectedColumnsJson: string; Days: number | null }>(
        "SELECT Id, Name, SourceKey, SelectedColumnsJson, Days FROM ReportTemplates WHERE CreatedByUserId = @userId ORDER BY Name"
      );
    const templates = result.recordset.map((r) => ({
      id: r.Id,
      name: r.Name,
      sourceKey: r.SourceKey,
      selectedColumns: JSON.parse(r.SelectedColumnsJson) as string[],
      days: r.Days,
    }));
    return NextResponse.json({ ok: true, templates });
  } catch {
    // Table not migrated yet - behave as if no templates exist rather than erroring the page.
    return NextResponse.json({ ok: true, templates: [] });
  }
}

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  sourceKey: z.string(),
  selectedColumns: z.array(z.string()).min(1),
  days: z.number().int().min(1).max(365).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template" }, { status: 400 });
  }

  try {
    const db = await getDb();
    await db
      .request()
      .input("name", sql.NVarChar, parsed.data.name)
      .input("sourceKey", sql.VarChar, parsed.data.sourceKey)
      .input("selectedColumnsJson", sql.NVarChar, JSON.stringify(parsed.data.selectedColumns))
      .input("days", sql.Int, parsed.data.days ?? null)
      .input("userId", sql.Int, admin.userId)
      .query(
        "INSERT INTO ReportTemplates (Name, SourceKey, SelectedColumnsJson, Days, CreatedByUserId) VALUES (@name, @sourceKey, @selectedColumnsJson, @days, @userId)"
      );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Report templates aren't set up yet on this server." }, { status: 503 });
  }
}
