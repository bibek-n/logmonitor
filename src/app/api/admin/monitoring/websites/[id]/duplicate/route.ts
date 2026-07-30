import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { loadWebsiteMonitorById } from "@/lib/websiteApiMonitoring/repository";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_website_create");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const monitor = await loadWebsiteMonitorById(Number(id));
  if (!monitor) return NextResponse.json({ ok: false, error: "Monitor not found" }, { status: 404 });

  const db = await getDb();
  const inserted = await db
    .request()
    .input("name", sql.NVarChar, `${monitor.name} (Copy)`)
    .input("description", sql.NVarChar, monitor.description)
    .input("environment", sql.VarChar, monitor.environment)
    .input("tags", sql.NVarChar, monitor.tags.join(","))
    .input("intervalSeconds", sql.Int, monitor.intervalSeconds)
    .input("timeoutMs", sql.Int, monitor.timeoutMs)
    .input("failureConfirmCount", sql.Int, monitor.failureConfirmCount)
    .input("recoveryConfirmCount", sql.Int, monitor.recoveryConfirmCount)
    .input("alertPolicyId", sql.Int, monitor.alertPolicyId)
    .input("createdByUserId", sql.Int, mon.userId)
    .query<{ Id: number }>(`
      INSERT INTO Monitors (MonitorType, Name, Description, Environment, Tags, IntervalSeconds, TimeoutMs,
        FailureConfirmCount, RecoveryConfirmCount, AlertPolicyId, IsActive, Status, CreatedByUserId)
      OUTPUT INSERTED.Id
      VALUES ('Website', @name, @description, @environment, @tags, @intervalSeconds, @timeoutMs,
        @failureConfirmCount, @recoveryConfirmCount, @alertPolicyId, 0, 'Paused', @createdByUserId)
    `);
  const newId = inserted.recordset[0].Id;

  await db
    .request()
    .input("monitorId", sql.Int, newId)
    .input("url", sql.NVarChar, monitor.config.url)
    .input("httpMethod", sql.VarChar, monitor.config.httpMethod)
    .input("expectedStatusCode", sql.Int, monitor.config.expectedStatusCode)
    .input("followRedirects", sql.Bit, monitor.config.followRedirects)
    .input("maxRedirects", sql.Int, monitor.config.maxRedirects)
    .input("sslVerify", sql.Bit, monitor.config.sslVerify)
    .input("expectedKeyword", sql.NVarChar, monitor.config.expectedKeyword)
    .input("forbiddenKeyword", sql.NVarChar, monitor.config.forbiddenKeyword)
    .input("responseTimeWarningMs", sql.Int, monitor.config.responseTimeWarningMs)
    .input("responseTimeCriticalMs", sql.Int, monitor.config.responseTimeCriticalMs)
    .input("alertEmail", sql.NVarChar, monitor.config.alertEmail)
    .query(`
      INSERT INTO WebsiteMonitorConfigs (MonitorId, Url, HttpMethod, ExpectedStatusCode, FollowRedirects, MaxRedirects,
        SslVerify, ExpectedKeyword, ForbiddenKeyword, ResponseTimeWarningMs, ResponseTimeCriticalMs, AlertEmail)
      VALUES (@monitorId, @url, @httpMethod, @expectedStatusCode, @followRedirects, @maxRedirects,
        @sslVerify, @expectedKeyword, @forbiddenKeyword, @responseTimeWarningMs, @responseTimeCriticalMs, @alertEmail)
    `);

  await logAdminAction({ admin: mon, section: "monitoring", action: "website_monitor_duplicate", details: `${monitor.name} -> ${newId}`, req });

  return NextResponse.json({ ok: true, data: { id: newId }, note: "Duplicated as paused - review and resume when ready." });
}
