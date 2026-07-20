import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { requireCodeQualityPermission, isCqSession } from "@/lib/requireCodeQualityPermission";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const cq = await requireCodeQualityPermission("cq_view");
  if (!isCqSession(cq)) return cq;

  const db = await getDb();
  const result = await db.query`SELECT * FROM CodeQualitySettings WHERE Id = 1`;
  return NextResponse.json({ ok: true, data: result.recordset[0] ?? null });
}

const updateSettingsSchema = z.object({
  complexityLowMax: z.number().int().min(1).max(500).optional(),
  complexityMediumMax: z.number().int().min(1).max(500).optional(),
  complexityHighMax: z.number().int().min(1).max(500).optional(),
  duplicationThresholdPercent: z.number().min(0).max(100).optional(),
  minDuplicateBlockSize: z.number().int().min(3).max(100).optional(),
  maxLineLength: z.number().int().min(40).max(500).optional(),
  weightComplexity: z.number().min(0).max(100).optional(),
  weightDuplication: z.number().min(0).max(100).optional(),
  weightDeadCode: z.number().min(0).max(100).optional(),
  weightUnusedVariables: z.number().min(0).max(100).optional(),
  weightUnusedFunctions: z.number().min(0).max(100).optional(),
  weightCodingStandards: z.number().min(0).max(100).optional(),
  scaleComplexity: z.number().min(0).max(100).optional(),
  scaleDuplication: z.number().min(0).max(100).optional(),
  scaleDeadCode: z.number().min(0).max(100).optional(),
  scaleUnusedVariables: z.number().min(0).max(100).optional(),
  scaleUnusedFunctions: z.number().min(0).max(100).optional(),
  scaleCodingStandards: z.number().min(0).max(100).optional(),
  excludedDirectories: z.array(z.string().trim().max(200)).max(200).optional(),
  allowedExtensions: z.array(z.string().trim().max(20)).max(50).optional(),
  maxScanSizeMb: z.number().int().min(1).max(20000).optional(),
  scanTimeoutSeconds: z.number().int().min(10).max(21600).optional(),
  retentionDays: z.number().int().min(1).max(3650).optional(),
});

const FIELD_TO_COLUMN: Record<string, string> = {
  complexityLowMax: "ComplexityLowMax",
  complexityMediumMax: "ComplexityMediumMax",
  complexityHighMax: "ComplexityHighMax",
  duplicationThresholdPercent: "DuplicationThresholdPercent",
  minDuplicateBlockSize: "MinDuplicateBlockSize",
  maxLineLength: "MaxLineLength",
  weightComplexity: "WeightComplexity",
  weightDuplication: "WeightDuplication",
  weightDeadCode: "WeightDeadCode",
  weightUnusedVariables: "WeightUnusedVariables",
  weightUnusedFunctions: "WeightUnusedFunctions",
  weightCodingStandards: "WeightCodingStandards",
  scaleComplexity: "ScaleComplexity",
  scaleDuplication: "ScaleDuplication",
  scaleDeadCode: "ScaleDeadCode",
  scaleUnusedVariables: "ScaleUnusedVariables",
  scaleUnusedFunctions: "ScaleUnusedFunctions",
  scaleCodingStandards: "ScaleCodingStandards",
  maxScanSizeMb: "MaxScanSizeMb",
  scanTimeoutSeconds: "ScanTimeoutSeconds",
  retentionDays: "RetentionDays",
};

export async function PATCH(req: NextRequest) {
  const cq = await requireCodeQualityPermission("cq_settings_manage");
  if (!isCqSession(cq)) return cq;

  const body = await req.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request body." }, { status: 400 });
  }
  const input = parsed.data;

  const setClauses: string[] = ["UpdatedAt = SYSUTCDATETIME()", "UpdatedByUserId = @updatedByUserId"];
  const db = await getDb();
  const request = db.request().input("updatedByUserId", sql.Int, cq.userId);

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

  await request.query(`UPDATE CodeQualitySettings SET ${setClauses.join(", ")} WHERE Id = 1`);
  await logAdminAction({ admin: cq, section: "code-quality", action: "update_settings", req });

  return NextResponse.json({ ok: true });
}
