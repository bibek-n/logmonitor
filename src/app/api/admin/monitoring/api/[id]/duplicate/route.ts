import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { loadApiMonitorById } from "@/lib/websiteApiMonitoring/repository";
import { encryptApiAuthConfig } from "@/lib/websiteApiMonitoring/apiCredentials";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_api_create");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const monitor = await loadApiMonitorById(Number(id));
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
      VALUES ('Api', @name, @description, @environment, @tags, @intervalSeconds, @timeoutMs,
        @failureConfirmCount, @recoveryConfirmCount, @alertPolicyId, 0, 'Paused', @createdByUserId)
    `);
  const newId = inserted.recordset[0].Id;

  // The duplicate keeps the real decrypted auth secret (re-encrypted under the new MonitorId's
  // own row) rather than requiring the user to re-enter it - the copy is meant to be a working,
  // ready-to-resume monitor, same as the website monitor duplicate route's behavior for its own
  // (unencrypted) config fields.
  await db
    .request()
    .input("monitorId", sql.Int, newId)
    .input("url", sql.NVarChar, monitor.config.url)
    .input("httpMethod", sql.VarChar, monitor.config.httpMethod)
    .input("headersJson", sql.NVarChar(sql.MAX), JSON.stringify(monitor.config.headers))
    .input("queryParamsJson", sql.NVarChar(sql.MAX), JSON.stringify(monitor.config.queryParams))
    .input("requestBody", sql.NVarChar(sql.MAX), monitor.config.requestBody)
    .input("requestBodyContentType", sql.VarChar, monitor.config.requestBodyContentType)
    .input("authType", sql.VarChar, monitor.config.authType)
    .input("authConfigEncrypted", sql.NVarChar(sql.MAX), encryptApiAuthConfig(monitor.config.authConfig))
    .input("expectedStatusCode", sql.Int, monitor.config.expectedStatusCode)
    .input("followRedirects", sql.Bit, monitor.config.followRedirects)
    .input("maxRedirects", sql.Int, monitor.config.maxRedirects)
    .input("sslVerify", sql.Bit, monitor.config.sslVerify)
    .input("assertionsJson", sql.NVarChar(sql.MAX), JSON.stringify(monitor.config.assertions))
    .input("responseTimeWarningMs", sql.Int, monitor.config.responseTimeWarningMs)
    .input("responseTimeCriticalMs", sql.Int, monitor.config.responseTimeCriticalMs)
    .input("alertEmail", sql.NVarChar, monitor.config.alertEmail)
    .query(`
      INSERT INTO ApiMonitorConfigs (MonitorId, Url, HttpMethod, HeadersJson, QueryParamsJson, RequestBody, RequestBodyContentType,
        AuthType, AuthConfigEncrypted, ExpectedStatusCode, FollowRedirects, MaxRedirects, SslVerify, AssertionsJson,
        ResponseTimeWarningMs, ResponseTimeCriticalMs, AlertEmail)
      VALUES (@monitorId, @url, @httpMethod, @headersJson, @queryParamsJson, @requestBody, @requestBodyContentType,
        @authType, @authConfigEncrypted, @expectedStatusCode, @followRedirects, @maxRedirects, @sslVerify, @assertionsJson,
        @responseTimeWarningMs, @responseTimeCriticalMs, @alertEmail)
    `);

  await logAdminAction({ admin: mon, section: "monitoring", action: "api_monitor_duplicate", details: `${monitor.name} -> ${newId}`, req });

  return NextResponse.json({ ok: true, data: { id: newId }, note: "Duplicated as paused - review and resume when ready." });
}
