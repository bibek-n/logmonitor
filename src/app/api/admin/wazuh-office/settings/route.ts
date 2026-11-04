import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { requireWazuhOfficePermission, isWazuhOfficeSession } from "@/lib/requireWazuhOfficePermission";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const wo = await requireWazuhOfficePermission("wo_view");
  if (!isWazuhOfficeSession(wo)) return wo;

  const db = await getDb();
  const result = await db.query(`
    SELECT SecurityEventRetentionDays, AlertRetentionDays, MetricRetentionDays,
      CpuHighThresholdPercent, MemoryHighThresholdPercent, DiskHighThresholdPercent,
      TempWarningC, TempHighC, TempCriticalC, TempEmergencyC,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM WazuhOfficeSettings WHERE Id = 1
  `);

  return NextResponse.json({ ok: true, data: result.recordset[0] });
}

const bodySchema = z.object({
  securityEventRetentionDays: z.number().int().min(1).max(3650).optional(),
  alertRetentionDays: z.number().int().min(1).max(3650).optional(),
  metricRetentionDays: z.number().int().min(1).max(3650).optional(),
  cpuHighThresholdPercent: z.number().min(1).max(100).optional(),
  memoryHighThresholdPercent: z.number().min(1).max(100).optional(),
  diskHighThresholdPercent: z.number().min(1).max(100).optional(),
  tempWarningC: z.number().optional(),
  tempHighC: z.number().optional(),
  tempCriticalC: z.number().optional(),
  tempEmergencyC: z.number().optional(),
});

export async function PATCH(req: NextRequest) {
  const wo = await requireWazuhOfficePermission("wo_manage_settings");
  if (!isWazuhOfficeSession(wo)) return wo;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid settings payload" }, { status: 400 });
  }
  const b = parsed.data;

  const db = await getDb();
  const request = db.request();
  const setClauses: string[] = [];

  if (b.securityEventRetentionDays !== undefined) { request.input("securityEventRetentionDays", sql.Int, b.securityEventRetentionDays); setClauses.push("SecurityEventRetentionDays = @securityEventRetentionDays"); }
  if (b.alertRetentionDays !== undefined) { request.input("alertRetentionDays", sql.Int, b.alertRetentionDays); setClauses.push("AlertRetentionDays = @alertRetentionDays"); }
  if (b.metricRetentionDays !== undefined) { request.input("metricRetentionDays", sql.Int, b.metricRetentionDays); setClauses.push("MetricRetentionDays = @metricRetentionDays"); }
  if (b.cpuHighThresholdPercent !== undefined) { request.input("cpuHighThresholdPercent", sql.Float, b.cpuHighThresholdPercent); setClauses.push("CpuHighThresholdPercent = @cpuHighThresholdPercent"); }
  if (b.memoryHighThresholdPercent !== undefined) { request.input("memoryHighThresholdPercent", sql.Float, b.memoryHighThresholdPercent); setClauses.push("MemoryHighThresholdPercent = @memoryHighThresholdPercent"); }
  if (b.diskHighThresholdPercent !== undefined) { request.input("diskHighThresholdPercent", sql.Float, b.diskHighThresholdPercent); setClauses.push("DiskHighThresholdPercent = @diskHighThresholdPercent"); }
  if (b.tempWarningC !== undefined) { request.input("tempWarningC", sql.Float, b.tempWarningC); setClauses.push("TempWarningC = @tempWarningC"); }
  if (b.tempHighC !== undefined) { request.input("tempHighC", sql.Float, b.tempHighC); setClauses.push("TempHighC = @tempHighC"); }
  if (b.tempCriticalC !== undefined) { request.input("tempCriticalC", sql.Float, b.tempCriticalC); setClauses.push("TempCriticalC = @tempCriticalC"); }
  if (b.tempEmergencyC !== undefined) { request.input("tempEmergencyC", sql.Float, b.tempEmergencyC); setClauses.push("TempEmergencyC = @tempEmergencyC"); }

  if (setClauses.length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
  }
  setClauses.push("UpdatedAt = SYSUTCDATETIME()");

  await request.query(`UPDATE WazuhOfficeSettings SET ${setClauses.join(", ")} WHERE Id = 1`);

  await logAdminAction({ admin: wo, section: "wazuh-office", action: "settings_update", details: JSON.stringify(b), req });

  return NextResponse.json({ ok: true });
}
