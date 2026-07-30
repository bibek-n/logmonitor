import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { updateWebsiteMonitorSchema } from "@/lib/websiteApiMonitoring/schema";
import { loadWebsiteMonitorById } from "@/lib/websiteApiMonitoring/repository";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_view");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const monitor = await loadWebsiteMonitorById(Number(id));
  if (!monitor) return NextResponse.json({ ok: false, error: "Monitor not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data: monitor });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_website_edit");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const monitorId = Number(id);
  const existing = await loadWebsiteMonitorById(monitorId);
  if (!existing) return NextResponse.json({ ok: false, error: "Monitor not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateWebsiteMonitorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid monitor payload" }, { status: 400 });
  }
  const p = parsed.data;
  const merged = {
    name: p.name ?? existing.name,
    description: p.description !== undefined ? p.description : existing.description,
    environment: p.environment !== undefined ? p.environment : existing.environment,
    tags: p.tags ?? existing.tags,
    intervalSeconds: p.intervalSeconds ?? existing.intervalSeconds,
    timeoutMs: p.timeoutMs ?? existing.timeoutMs,
    failureConfirmCount: p.failureConfirmCount ?? existing.failureConfirmCount,
    recoveryConfirmCount: p.recoveryConfirmCount ?? existing.recoveryConfirmCount,
    alertPolicyId: p.alertPolicyId !== undefined ? p.alertPolicyId : existing.alertPolicyId,
    isActive: p.isActive ?? existing.isActive,
    url: p.url ?? existing.config.url,
    httpMethod: p.httpMethod ?? existing.config.httpMethod,
    expectedStatusCode: p.expectedStatusCode ?? existing.config.expectedStatusCode,
    followRedirects: p.followRedirects ?? existing.config.followRedirects,
    maxRedirects: p.maxRedirects ?? existing.config.maxRedirects,
    sslVerify: p.sslVerify ?? existing.config.sslVerify,
    expectedKeyword: p.expectedKeyword !== undefined ? p.expectedKeyword : existing.config.expectedKeyword,
    forbiddenKeyword: p.forbiddenKeyword !== undefined ? p.forbiddenKeyword : existing.config.forbiddenKeyword,
    responseTimeWarningMs: p.responseTimeWarningMs ?? existing.config.responseTimeWarningMs,
    responseTimeCriticalMs: p.responseTimeCriticalMs ?? existing.config.responseTimeCriticalMs,
    alertEmail: p.alertEmail !== undefined ? p.alertEmail : existing.config.alertEmail,
  };

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, monitorId)
    .input("name", sql.NVarChar, merged.name)
    .input("description", sql.NVarChar, merged.description)
    .input("environment", sql.VarChar, merged.environment)
    .input("tags", sql.NVarChar, merged.tags.join(","))
    .input("intervalSeconds", sql.Int, merged.intervalSeconds)
    .input("timeoutMs", sql.Int, merged.timeoutMs)
    .input("failureConfirmCount", sql.Int, merged.failureConfirmCount)
    .input("recoveryConfirmCount", sql.Int, merged.recoveryConfirmCount)
    .input("alertPolicyId", sql.Int, merged.alertPolicyId)
    .input("isActive", sql.Bit, merged.isActive)
    .input("updatedByUserId", sql.Int, mon.userId)
    .query(`
      UPDATE Monitors SET Name=@name, Description=@description, Environment=@environment, Tags=@tags,
        IntervalSeconds=@intervalSeconds, TimeoutMs=@timeoutMs, FailureConfirmCount=@failureConfirmCount,
        RecoveryConfirmCount=@recoveryConfirmCount, AlertPolicyId=@alertPolicyId, IsActive=@isActive,
        UpdatedByUserId=@updatedByUserId, UpdatedAt=SYSUTCDATETIME()
      WHERE Id=@id
    `);

  await db
    .request()
    .input("monitorId", sql.Int, monitorId)
    .input("url", sql.NVarChar, merged.url)
    .input("httpMethod", sql.VarChar, merged.httpMethod)
    .input("expectedStatusCode", sql.Int, merged.expectedStatusCode)
    .input("followRedirects", sql.Bit, merged.followRedirects)
    .input("maxRedirects", sql.Int, merged.maxRedirects)
    .input("sslVerify", sql.Bit, merged.sslVerify)
    .input("expectedKeyword", sql.NVarChar, merged.expectedKeyword)
    .input("forbiddenKeyword", sql.NVarChar, merged.forbiddenKeyword)
    .input("responseTimeWarningMs", sql.Int, merged.responseTimeWarningMs)
    .input("responseTimeCriticalMs", sql.Int, merged.responseTimeCriticalMs)
    .input("alertEmail", sql.NVarChar, merged.alertEmail)
    .query(`
      UPDATE WebsiteMonitorConfigs SET Url=@url, HttpMethod=@httpMethod, ExpectedStatusCode=@expectedStatusCode,
        FollowRedirects=@followRedirects, MaxRedirects=@maxRedirects, SslVerify=@sslVerify,
        ExpectedKeyword=@expectedKeyword, ForbiddenKeyword=@forbiddenKeyword,
        ResponseTimeWarningMs=@responseTimeWarningMs, ResponseTimeCriticalMs=@responseTimeCriticalMs,
        AlertEmail=@alertEmail
      WHERE MonitorId=@monitorId
    `);

  await logAdminAction({ admin: mon, section: "monitoring", action: "website_monitor_update", details: merged.name, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_website_delete");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const monitorId = Number(id);
  const existing = await loadWebsiteMonitorById(monitorId);
  if (!existing) return NextResponse.json({ ok: false, error: "Monitor not found" }, { status: 404 });

  const db = await getDb();
  await db.request().input("id", sql.Int, monitorId).query("UPDATE Monitors SET IsDeleted = 1 WHERE Id = @id");

  await logAdminAction({ admin: mon, section: "monitoring", action: "website_monitor_delete", details: existing.name, req });

  return NextResponse.json({ ok: true });
}
