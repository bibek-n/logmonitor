import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { requireLaravelSecurityPermission, isLsSession } from "@/lib/requireLaravelSecurityPermission";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const ls = await requireLaravelSecurityPermission("ls_view");
  if (!isLsSession(ls)) return ls;

  const db = await getDb();
  const result = await db.query`SELECT * FROM LaravelSecuritySettings WHERE Id = 1`;
  return NextResponse.json({ ok: true, data: result.recordset[0] ?? null });
}

const updateSettingsSchema = z.object({
  weightAppDebug: z.number().min(0).max(100).optional(),
  weightAppKey: z.number().min(0).max(100).optional(),
  weightDotEnv: z.number().min(0).max(100).optional(),
  weightCsrf: z.number().min(0).max(100).optional(),
  weightMassAssignment: z.number().min(0).max(100).optional(),
  weightValidation: z.number().min(0).max(100).optional(),
  weightSanitization: z.number().min(0).max(100).optional(),
  weightStorageLinks: z.number().min(0).max(100).optional(),
  weightQueue: z.number().min(0).max(100).optional(),
  pointsPerIssueLow: z.number().min(0).max(100).optional(),
  pointsPerIssueMedium: z.number().min(0).max(100).optional(),
  pointsPerIssueHigh: z.number().min(0).max(100).optional(),
  pointsPerIssueCritical: z.number().min(0).max(100).optional(),
  excludedDirectories: z.array(z.string().trim().max(200)).max(200).optional(),
  allowedExtensions: z.array(z.string().trim().max(20)).max(50).optional(),
  maxScanSizeMb: z.number().int().min(1).max(20000).optional(),
  scanTimeoutSeconds: z.number().int().min(10).max(21600).optional(),
  retentionDays: z.number().int().min(1).max(3650).optional(),
});

const FIELD_TO_COLUMN: Record<string, string> = {
  weightAppDebug: "WeightAppDebug",
  weightAppKey: "WeightAppKey",
  weightDotEnv: "WeightDotEnv",
  weightCsrf: "WeightCsrf",
  weightMassAssignment: "WeightMassAssignment",
  weightValidation: "WeightValidation",
  weightSanitization: "WeightSanitization",
  weightStorageLinks: "WeightStorageLinks",
  weightQueue: "WeightQueue",
  pointsPerIssueLow: "PointsPerIssueLow",
  pointsPerIssueMedium: "PointsPerIssueMedium",
  pointsPerIssueHigh: "PointsPerIssueHigh",
  pointsPerIssueCritical: "PointsPerIssueCritical",
  maxScanSizeMb: "MaxScanSizeMb",
  scanTimeoutSeconds: "ScanTimeoutSeconds",
  retentionDays: "RetentionDays",
};

export async function PATCH(req: NextRequest) {
  const ls = await requireLaravelSecurityPermission("ls_settings_manage");
  if (!isLsSession(ls)) return ls;

  const body = await req.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request body." }, { status: 400 });
  }
  const input = parsed.data;

  const setClauses: string[] = ["UpdatedAt = SYSUTCDATETIME()", "UpdatedByUserId = @updatedByUserId"];
  const db = await getDb();
  const request = db.request().input("updatedByUserId", sql.Int, ls.userId);

  for (const [field, column] of Object.entries(FIELD_TO_COLUMN)) {
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined) continue;
    setClauses.push(`${column} = @${field}`);
    request.input(field, typeof value === "number" ? sql.Float : sql.NVarChar, value);
  }
  if (input.excludedDirectories !== undefined) {
    setClauses.push("ExcludedDirectories = @excludedDirectories");
    request.input("excludedDirectories", sql.NVarChar, JSON.stringify(input.excludedDirectories));
  }
  if (input.allowedExtensions !== undefined) {
    setClauses.push("AllowedExtensions = @allowedExtensions");
    request.input("allowedExtensions", sql.NVarChar, input.allowedExtensions.join(","));
  }

  if (setClauses.length === 2) return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });

  await request.query(`UPDATE LaravelSecuritySettings SET ${setClauses.join(", ")} WHERE Id = 1`);
  await logAdminAction({ admin: ls, section: "laravel-security", action: "update_settings", req });

  return NextResponse.json({ ok: true });
}
