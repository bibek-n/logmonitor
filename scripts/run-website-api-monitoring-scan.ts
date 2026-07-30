import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import { listDueWebsiteMonitors, listDueApiMonitors } from "../src/lib/websiteApiMonitoring/repository";
import { checkWebsite } from "../src/lib/websiteApiMonitoring/websiteChecker";
import { checkApi } from "../src/lib/websiteApiMonitoring/apiChecker";
import { checkMultiRegion, RegionCheckOutcome } from "../src/lib/websiteApiMonitoring/multiRegionChecker";
import { evaluateCheckResult, MonitorRuntimeState } from "../src/lib/websiteApiMonitoring/monitorState";
import { openIncidentIfNeeded, resolveIncidentIfOpen } from "../src/lib/websiteApiMonitoring/incidentService";
import { evaluateSslExpiry } from "../src/lib/websiteApiMonitoring/sslEvaluator";
import { buildAlertMessage, sendMonitoringAlert } from "../src/lib/websiteApiMonitoring/notifications";
import { pruneOldResults } from "../src/lib/websiteApiMonitoring/retention";
import { getActiveMaintenanceMonitorIds, syncMaintenanceStatuses } from "../src/lib/websiteApiMonitoring/maintenanceWindows";
import { processEscalations } from "../src/lib/websiteApiMonitoring/escalation";
import { processNotificationRetries } from "../src/lib/websiteApiMonitoring/notificationRetry";
import { processSlaBreaches } from "../src/lib/websiteApiMonitoring/slaEvaluator";
import { MonitorCheckLimits, WebsiteCheckResult } from "../src/lib/websiteApiMonitoring/types";

// Bounds one pass's worst case, matching the same "bounded incremental catch-up" convention as
// aggregation.ts's MAX_HOURLY_BUCKETS_PER_RUN - a pathological backlog (a burst of newly-added
// monitors, or a slow check-host.net) drains gradually across successive runs instead of ever
// making a single run's duration unbounded. Combined with listDueWebsiteMonitors' ORDER BY
// NextCheckAt ASC, the monitors left over always carry into next run's due set first.
const MAX_WEBSITE_MONITORS_PER_RUN = 100;
const MAX_API_MONITORS_PER_RUN = 100;

function summarizeRegions(regions: RegionCheckOutcome[]): string {
  return regions.map((r) => `${r.region}: ${r.success ? "OK" : r.error ?? "failed"}`).join(", ");
}

// Merges the real, per-monitor-config local check (still the only source for SSL certificate
// details and content-keyword matching - check-host.net's probes don't fetch response bodies
// or expose certificate info) with a majority vote across independent external regions, which
// now decides plain reachability/expected-status-code success. This is what fixes false Down
// results caused by this app's own server having a local network problem (blocked DNS/IP
// range) reaching a site that's actually fine everywhere else - a single region's local issue
// can no longer flip a monitor to Down by itself. Falls back to the local-only result verbatim
// if check-host.net itself couldn't be reached at all, so a third-party outage never blocks
// monitoring altogether.
async function determineEffectiveResult(local: WebsiteCheckResult, url: string, expectedStatusCode: number, followRedirects: boolean): Promise<{ result: WebsiteCheckResult; regionsJson: string | null }> {
  const multiRegion = await checkMultiRegion(url, expectedStatusCode, followRedirects);
  if (!multiRegion.available) {
    return { result: local, regionsJson: null };
  }

  const contentCheckOk = local.contentCheck === null || local.contentCheck.passed;
  const success = multiRegion.success && contentCheckOk;

  let errorCode: string | null = null;
  let errorMessage: string | null = null;
  if (!success) {
    if (!multiRegion.success) {
      errorCode = "UNEXPECTED_STATUS";
      errorMessage = `Down in ${multiRegion.regions.filter((r) => !r.success).length}/${multiRegion.regions.length} checked regions (${summarizeRegions(multiRegion.regions)}).`;
    } else {
      errorCode = "CONTENT_CHECK_FAILED";
      errorMessage = local.contentCheck?.reason ?? "Content check failed.";
    }
  }

  return {
    result: {
      ...local,
      success,
      httpStatusCode: multiRegion.httpStatusCode ?? local.httpStatusCode,
      totalMs: multiRegion.avgResponseMs ?? local.totalMs,
      errorCode,
      errorMessage,
    },
    regionsJson: JSON.stringify(multiRegion.regions),
  };
}

async function processMonitor(monitor: Awaited<ReturnType<typeof listDueWebsiteMonitors>>[number]): Promise<void> {
  const db = await getDb();
  const limits: MonitorCheckLimits = { timeoutMs: monitor.timeoutMs, maxRedirects: monitor.config.maxRedirects, maxResponseBytes: 25 * 1024 * 1024 };

  const localResult = await checkWebsite(monitor.config, limits);
  const { result, regionsJson } = await determineEffectiveResult(localResult, monitor.config.url, monitor.config.expectedStatusCode, monitor.config.followRedirects);

  await db
    .request()
    .input("monitorId", sql.Int, monitor.id)
    .input("success", sql.Bit, result.success)
    .input("httpStatusCode", sql.Int, result.httpStatusCode)
    .input("dnsMs", sql.Int, result.dnsMs)
    .input("tcpMs", sql.Int, result.tcpMs)
    .input("tlsMs", sql.Int, result.tlsMs)
    .input("ttfbMs", sql.Int, result.ttfbMs)
    .input("totalMs", sql.Int, result.totalMs)
    .input("responseSizeBytes", sql.BigInt, result.responseSizeBytes)
    .input("redirectCount", sql.Int, result.redirectCount)
    .input("finalUrl", sql.NVarChar, result.finalUrl)
    .input("contentCheckResultJson", sql.NVarChar(sql.MAX), result.contentCheck ? JSON.stringify(result.contentCheck) : null)
    .input("regionCheckResultsJson", sql.NVarChar(sql.MAX), regionsJson)
    .input("errorCode", sql.VarChar, result.errorCode)
    .input("errorMessage", sql.NVarChar, result.errorMessage)
    .query(`
      INSERT INTO MonitorResults (MonitorId, Success, HttpStatusCode, DnsMs, TcpMs, TlsMs, TtfbMs, TotalMs,
        ResponseSizeBytes, RedirectCount, FinalUrl, ContentCheckResultJson, RegionCheckResultsJson, ErrorCode, ErrorMessage)
      VALUES (@monitorId, @success, @httpStatusCode, @dnsMs, @tcpMs, @tlsMs, @ttfbMs, @totalMs,
        @responseSizeBytes, @redirectCount, @finalUrl, @contentCheckResultJson, @regionCheckResultsJson, @errorCode, @errorMessage)
    `);

  if (result.ssl && result.ssl.expiresAt) {
    const existingSsl = await db
      .request()
      .input("monitorId", sql.Int, monitor.id)
      .query<{ ExpiresAt: string | null; LastAlertThresholdDays: number | null }>(
        "SELECT CONVERT(VARCHAR(33), ExpiresAt, 126) AS ExpiresAt, LastAlertThresholdDays FROM SslCertificateRecords WHERE MonitorId = @monitorId"
      );
    const prior = existingSsl.recordset[0];
    const isNewCertificate = !prior?.ExpiresAt || new Date(prior.ExpiresAt).getTime() !== result.ssl.expiresAt.getTime();
    const lastAlertedThresholdDays = isNewCertificate ? null : prior!.LastAlertThresholdDays;

    await db
      .request()
      .input("monitorId", sql.Int, monitor.id)
      .input("domain", sql.NVarChar, result.ssl.domain)
      .input("issuer", sql.NVarChar, result.ssl.issuer)
      .input("subject", sql.NVarChar, result.ssl.subject)
      .input("validFrom", sql.DateTime2, result.ssl.validFrom)
      .input("expiresAt", sql.DateTime2, result.ssl.expiresAt)
      .input("hostnameMatch", sql.Bit, result.ssl.hostnameMatch)
      .input("chainValid", sql.Bit, result.ssl.chainValid)
      .input("selfSigned", sql.Bit, result.ssl.selfSigned)
      .input("tlsProtocol", sql.VarChar, result.ssl.tlsProtocol)
      .input("signatureAlgorithm", sql.VarChar, result.ssl.signatureAlgorithm)
      .query(`
        MERGE SslCertificateRecords AS target
        USING (SELECT @monitorId AS MonitorId) AS src ON target.MonitorId = src.MonitorId
        WHEN MATCHED THEN UPDATE SET Domain=@domain, Issuer=@issuer, Subject=@subject, ValidFrom=@validFrom, ExpiresAt=@expiresAt,
          HostnameMatch=@hostnameMatch, ChainValid=@chainValid, SelfSigned=@selfSigned, TlsProtocol=@tlsProtocol,
          SignatureAlgorithm=@signatureAlgorithm, LastCheckedAt=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (MonitorId, Domain, Issuer, Subject, ValidFrom, ExpiresAt, HostnameMatch, ChainValid,
          SelfSigned, TlsProtocol, SignatureAlgorithm, LastCheckedAt)
          VALUES (@monitorId, @domain, @issuer, @subject, @validFrom, @expiresAt, @hostnameMatch, @chainValid,
          @selfSigned, @tlsProtocol, @signatureAlgorithm, SYSUTCDATETIME());
      `);

    const daysRemaining = Math.floor((result.ssl.expiresAt.getTime() - Date.now()) / 86400000);
    const sslDecision = evaluateSslExpiry(daysRemaining, lastAlertedThresholdDays);
    if (sslDecision.shouldAlert) {
      await db
        .request()
        .input("monitorId", sql.Int, monitor.id)
        .input("threshold", sql.Int, sslDecision.crossedThresholdDays)
        .query("UPDATE SslCertificateRecords SET LastAlertThresholdDays = @threshold WHERE MonitorId = @monitorId");

      const eventType = sslDecision.isExpired ? "SslExpired" : "SslExpiring";
      const msg = buildAlertMessage(eventType, monitor.name, monitor.config.url, `${daysRemaining} day(s) remaining.`);
      await sendMonitoringAlert({ eventType, alertPolicyId: monitor.alertPolicyId, monitorAlertEmail: monitor.config.alertEmail, monitorId: monitor.id, incidentId: null, subject: msg.subject, body: msg.body });
    }
  }

  const state: MonitorRuntimeState = {
    status: monitor.status,
    consecutiveFailures: monitor.consecutiveFailures,
    consecutiveSuccesses: monitor.consecutiveSuccesses,
    failureConfirmCount: monitor.failureConfirmCount,
    recoveryConfirmCount: monitor.recoveryConfirmCount,
  };
  const transition = evaluateCheckResult(state, result, monitor.config);

  await db
    .request()
    .input("id", sql.Int, monitor.id)
    .input("status", sql.VarChar, transition.newStatus)
    .input("consecutiveFailures", sql.Int, transition.newConsecutiveFailures)
    .input("consecutiveSuccesses", sql.Int, transition.newConsecutiveSuccesses)
    .input("nextCheckAt", sql.DateTime2, new Date(Date.now() + monitor.intervalSeconds * 1000))
    .query(`
      UPDATE Monitors SET Status=@status, ConsecutiveFailures=@consecutiveFailures, ConsecutiveSuccesses=@consecutiveSuccesses,
        LastCheckedAt=SYSUTCDATETIME(), NextCheckAt=@nextCheckAt
      WHERE Id=@id
    `);

  if (transition.shouldOpenIncident) {
    const incidentId = await openIncidentIfNeeded({
      monitorId: monitor.id,
      monitorName: monitor.name,
      failureReason: result.errorMessage,
      httpStatusCode: result.httpStatusCode,
    });
    const msg = buildAlertMessage("WebsiteDown", monitor.name, monitor.config.url, result.errorMessage);
    await sendMonitoringAlert({ eventType: "WebsiteDown", alertPolicyId: monitor.alertPolicyId, monitorAlertEmail: monitor.config.alertEmail, monitorId: monitor.id, incidentId, subject: msg.subject, body: msg.body });
  }

  if (transition.shouldResolveIncident) {
    const incidentId = await resolveIncidentIfOpen(monitor.id);
    const msg = buildAlertMessage("WebsiteRecovered", monitor.name, monitor.config.url, null);
    await sendMonitoringAlert({ eventType: "WebsiteRecovered", alertPolicyId: monitor.alertPolicyId, monitorAlertEmail: monitor.config.alertEmail, monitorId: monitor.id, incidentId, subject: msg.subject, body: msg.body });
  }

  if (transition.isDegraded && transition.newStatus === "Degraded") {
    const msg = buildAlertMessage("WebsiteDegraded", monitor.name, monitor.config.url, `Response time ${result.totalMs}ms exceeded the ${monitor.config.responseTimeWarningMs}ms warning threshold.`);
    await sendMonitoringAlert({ eventType: "WebsiteDegraded", alertPolicyId: monitor.alertPolicyId, monitorAlertEmail: monitor.config.alertEmail, monitorId: monitor.id, incidentId: null, subject: msg.subject, body: msg.body });
  }
}

async function processApiMonitor(monitor: Awaited<ReturnType<typeof listDueApiMonitors>>[number]): Promise<void> {
  const db = await getDb();
  const limits: MonitorCheckLimits = { timeoutMs: monitor.timeoutMs, maxRedirects: monitor.config.maxRedirects, maxResponseBytes: 25 * 1024 * 1024 };

  const result = await checkApi(monitor.config, limits);

  await db
    .request()
    .input("monitorId", sql.Int, monitor.id)
    .input("success", sql.Bit, result.success)
    .input("httpStatusCode", sql.Int, result.httpStatusCode)
    .input("dnsMs", sql.Int, result.dnsMs)
    .input("tcpMs", sql.Int, result.tcpMs)
    .input("tlsMs", sql.Int, result.tlsMs)
    .input("ttfbMs", sql.Int, result.ttfbMs)
    .input("totalMs", sql.Int, result.totalMs)
    .input("responseSizeBytes", sql.BigInt, result.responseSizeBytes)
    .input("redirectCount", sql.Int, result.redirectCount)
    .input("finalUrl", sql.NVarChar, result.finalUrl)
    .input("assertionResultsJson", sql.NVarChar(sql.MAX), result.assertionResults.length > 0 ? JSON.stringify(result.assertionResults) : null)
    .input("errorCode", sql.VarChar, result.errorCode)
    .input("errorMessage", sql.NVarChar, result.errorMessage)
    .query(`
      INSERT INTO MonitorResults (MonitorId, Success, HttpStatusCode, DnsMs, TcpMs, TlsMs, TtfbMs, TotalMs,
        ResponseSizeBytes, RedirectCount, FinalUrl, AssertionResultsJson, ErrorCode, ErrorMessage)
      VALUES (@monitorId, @success, @httpStatusCode, @dnsMs, @tcpMs, @tlsMs, @ttfbMs, @totalMs,
        @responseSizeBytes, @redirectCount, @finalUrl, @assertionResultsJson, @errorCode, @errorMessage)
    `);

  const state: MonitorRuntimeState = {
    status: monitor.status,
    consecutiveFailures: monitor.consecutiveFailures,
    consecutiveSuccesses: monitor.consecutiveSuccesses,
    failureConfirmCount: monitor.failureConfirmCount,
    recoveryConfirmCount: monitor.recoveryConfirmCount,
  };
  const transition = evaluateCheckResult(state, result, monitor.config);

  await db
    .request()
    .input("id", sql.Int, monitor.id)
    .input("status", sql.VarChar, transition.newStatus)
    .input("consecutiveFailures", sql.Int, transition.newConsecutiveFailures)
    .input("consecutiveSuccesses", sql.Int, transition.newConsecutiveSuccesses)
    .input("nextCheckAt", sql.DateTime2, new Date(Date.now() + monitor.intervalSeconds * 1000))
    .query(`
      UPDATE Monitors SET Status=@status, ConsecutiveFailures=@consecutiveFailures, ConsecutiveSuccesses=@consecutiveSuccesses,
        LastCheckedAt=SYSUTCDATETIME(), NextCheckAt=@nextCheckAt
      WHERE Id=@id
    `);

  if (transition.shouldOpenIncident) {
    const incidentId = await openIncidentIfNeeded({
      monitorId: monitor.id,
      monitorName: monitor.name,
      failureReason: result.errorMessage,
      httpStatusCode: result.httpStatusCode,
    });
    const msg = buildAlertMessage("ApiDown", monitor.name, monitor.config.url, result.errorMessage);
    await sendMonitoringAlert({ eventType: "ApiDown", alertPolicyId: monitor.alertPolicyId, monitorAlertEmail: monitor.config.alertEmail, monitorId: monitor.id, incidentId, subject: msg.subject, body: msg.body });
  }

  if (transition.shouldResolveIncident) {
    const incidentId = await resolveIncidentIfOpen(monitor.id);
    const msg = buildAlertMessage("ApiRecovered", monitor.name, monitor.config.url, null);
    await sendMonitoringAlert({ eventType: "ApiRecovered", alertPolicyId: monitor.alertPolicyId, monitorAlertEmail: monitor.config.alertEmail, monitorId: monitor.id, incidentId, subject: msg.subject, body: msg.body });
  }

  if (transition.isDegraded && transition.newStatus === "Degraded") {
    const msg = buildAlertMessage("ApiDegraded", monitor.name, monitor.config.url, `Response time ${result.totalMs}ms exceeded the ${monitor.config.responseTimeWarningMs}ms warning threshold.`);
    await sendMonitoringAlert({ eventType: "ApiDegraded", alertPolicyId: monitor.alertPolicyId, monitorAlertEmail: monitor.config.alertEmail, monitorId: monitor.id, incidentId: null, subject: msg.subject, body: msg.body });
  }
}

async function main() {
  // Maintenance Windows are synced first, every pass: any monitor now inside an active window
  // gets Status='Maintenance' (excluding it from listDueWebsiteMonitors/listDueApiMonitors,
  // both of which now filter it out - see repository.ts), and any monitor that just LEFT its
  // window goes back to 'Pending' so its next real check decides its status fresh.
  const activeMaintenanceMonitorIds = await getActiveMaintenanceMonitorIds();
  await syncMaintenanceStatuses(activeMaintenanceMonitorIds);
  if (activeMaintenanceMonitorIds.size > 0) console.log(`${activeMaintenanceMonitorIds.size} monitor(s) currently in an active maintenance window - skipped.`);

  const dueWebsitesAll = await listDueWebsiteMonitors();
  const dueApisAll = await listDueApiMonitors();
  const dueWebsites = dueWebsitesAll.slice(0, MAX_WEBSITE_MONITORS_PER_RUN);
  const dueApis = dueApisAll.slice(0, MAX_API_MONITORS_PER_RUN);
  console.log(`Website & API Monitoring scan: ${dueWebsites.length}/${dueWebsitesAll.length} website monitor(s), ${dueApis.length}/${dueApisAll.length} API monitor(s) due.`);
  if (dueWebsitesAll.length > dueWebsites.length || dueApisAll.length > dueApis.length) {
    console.log(`Backlog exceeds this run's cap - ${dueWebsitesAll.length - dueWebsites.length} website + ${dueApisAll.length - dueApis.length} API monitor(s) carry into the next run.`);
  }

  // Serial processing, matching this app's established scheduled-job convention (Website
  // Performance/SQL Server Monitoring both process their due work in a plain for-loop, not a
  // worker pool) - see the plan's job-queue correction. A single monitor's failure must never
  // stop the rest of the pass.
  for (const monitor of dueWebsites) {
    try {
      await processMonitor(monitor);
    } catch (err) {
      console.error(`Failed to process website monitor ${monitor.id} (${monitor.name}):`, err instanceof Error ? err.message : err);
    }
    // A short pause between monitors keeps this pass from bursting check-host.net's free public
    // API hard enough to get rate-limited (observed "Too Many Requests" from one of its region
    // nodes when every due monitor was forced to recheck at once) - a normal pass rarely has
    // that many monitors due in the same minute, but this costs little and removes the risk.
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // API monitors never call check-host.net (no multi-region checking for this monitor type),
  // so there's no shared rate limit to pace around here.
  for (const monitor of dueApis) {
    try {
      await processApiMonitor(monitor);
    } catch (err) {
      console.error(`Failed to process API monitor ${monitor.id} (${monitor.name}):`, err instanceof Error ? err.message : err);
    }
  }

  // Escalation (unacknowledged Open incidents on an escalation-enabled policy) and notification
  // retry (Failed sends past their backoff) both run once per pass, after every due monitor has
  // had its chance to auto-resolve/newly-open an incident this round.
  await processEscalations();
  await processNotificationRetries();
  await processSlaBreaches();

  const pruned = await pruneOldResults();
  if (pruned > 0) console.log(`Pruned ${pruned} MonitorResults row(s) past the retention window.`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
