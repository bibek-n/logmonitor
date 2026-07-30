import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { updateMonitoringSettingsSchema } from "@/lib/websiteApiMonitoring/schema";

export async function GET() {
  const mon = await requireMonitoringPermission("mon_view");
  if (!isMonitoringSession(mon)) return mon;

  const db = await getDb();
  const result = await db.query("SELECT * FROM MonitoringSettings WHERE Id = 1");
  return NextResponse.json({ ok: true, data: result.recordset[0] });
}

export async function PUT(req: NextRequest) {
  const mon = await requireMonitoringPermission("mon_settings_manage");
  if (!isMonitoringSession(mon)) return mon;

  const body = await req.json().catch(() => null);
  const parsed = updateMonitoringSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings payload" }, { status: 400 });
  }
  const p = parsed.data;

  const db = await getDb();
  const existing = await db.query("SELECT * FROM MonitoringSettings WHERE Id = 1");
  const current = existing.recordset[0];

  await db
    .request()
    .input("defaultIntervalSeconds", sql.Int, p.defaultIntervalSeconds ?? current.DefaultIntervalSeconds)
    .input("defaultTimeoutMs", sql.Int, p.defaultTimeoutMs ?? current.DefaultTimeoutMs)
    .input("defaultFailureConfirmCount", sql.Int, p.defaultFailureConfirmCount ?? current.DefaultFailureConfirmCount)
    .input("defaultRecoveryConfirmCount", sql.Int, p.defaultRecoveryConfirmCount ?? current.DefaultRecoveryConfirmCount)
    .input("defaultResponseWarningMs", sql.Int, p.defaultResponseWarningMs ?? current.DefaultResponseWarningMs)
    .input("defaultResponseCriticalMs", sql.Int, p.defaultResponseCriticalMs ?? current.DefaultResponseCriticalMs)
    .input("defaultAlertPolicyId", sql.Int, p.defaultAlertPolicyId !== undefined ? p.defaultAlertPolicyId : current.DefaultAlertPolicyId)
    .input("dataRetentionDays", sql.Int, p.dataRetentionDays ?? current.DataRetentionDays)
    .input("maxResponseSizeBytes", sql.BigInt, p.maxResponseSizeBytes ?? current.MaxResponseSizeBytes)
    .input("defaultUserAgent", sql.NVarChar, p.defaultUserAgent ?? current.DefaultUserAgent)
    .input("blockPrivateNetworks", sql.Bit, p.blockPrivateNetworks ?? current.BlockPrivateNetworks)
    .input("maxRedirects", sql.Int, p.maxRedirects ?? current.MaxRedirects)
    .query(`
      UPDATE MonitoringSettings SET
        DefaultIntervalSeconds=@defaultIntervalSeconds, DefaultTimeoutMs=@defaultTimeoutMs,
        DefaultFailureConfirmCount=@defaultFailureConfirmCount, DefaultRecoveryConfirmCount=@defaultRecoveryConfirmCount,
        DefaultResponseWarningMs=@defaultResponseWarningMs, DefaultResponseCriticalMs=@defaultResponseCriticalMs,
        DefaultAlertPolicyId=@defaultAlertPolicyId, DataRetentionDays=@dataRetentionDays,
        MaxResponseSizeBytes=@maxResponseSizeBytes, DefaultUserAgent=@defaultUserAgent,
        BlockPrivateNetworks=@blockPrivateNetworks, MaxRedirects=@maxRedirects
      WHERE Id = 1
    `);

  await logAdminAction({ admin: mon, section: "monitoring", action: "settings_update", req });

  return NextResponse.json({ ok: true });
}
