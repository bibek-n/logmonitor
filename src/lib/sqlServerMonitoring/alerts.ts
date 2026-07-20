import { sql } from "@/lib/db";
import type { ConnectionPool } from "mssql";
import { sendNotificationEmail } from "@/lib/notifyEmail";

const ALERT_RECIPIENT = "bibek@tulipstechnologies.com";

// Once an instance is known down, don't re-send on every 5-minute collection pass - only the
// first failure and then a periodic reminder if it's still down an hour later.
const DOWN_ALERT_COOLDOWN_MS = 60 * 60 * 1000;

// Called from an engine collector's failure path. Sends at most one email for a new outage,
// then at most one reminder per cooldown window while it stays down - not one every pass.
export async function notifyInstanceDown(
  db: ConnectionPool,
  instanceId: number,
  instanceName: string,
  hostLabel: string,
  previousStatus: string | null,
  lastDownAlertAt: string | null,
  errorMessage: string
): Promise<void> {
  const wasAlreadyDown = previousStatus === "Failed";
  const cooldownExpired = !lastDownAlertAt || Date.now() - new Date(lastDownAlertAt).getTime() > DOWN_ALERT_COOLDOWN_MS;
  if (wasAlreadyDown && !cooldownExpired) return;

  const result = await sendNotificationEmail({
    to: ALERT_RECIPIENT,
    subject: `Database Alert: "${instanceName}" is unreachable`,
    body: [
      `The SQL Server Monitoring collector could not reach "${instanceName}" (${hostLabel}).`,
      "",
      `Error: ${errorMessage}`,
      `Detected at: ${new Date().toISOString()}`,
      "",
      "This is an automated alert from LogMonitor.",
    ].join("\n"),
  });
  if (!result.success) {
    console.error(`[sqlServerMonitoring] failed to send down-alert email for instance ${instanceId}: ${result.error}`);
  }

  await db
    .request()
    .input("id", sql.Int, instanceId)
    .query("UPDATE SqlServerInstances SET LastDownAlertAt = SYSUTCDATETIME() WHERE Id = @id")
    .catch(() => {});
}

// Called from an engine collector's success path. Only fires when the instance was previously
// in a Failed state, so a normal healthy pass never sends anything.
export async function notifyInstanceRecovered(db: ConnectionPool, instanceId: number, instanceName: string, hostLabel: string, previousStatus: string | null): Promise<void> {
  if (previousStatus !== "Failed") return;

  const result = await sendNotificationEmail({
    to: ALERT_RECIPIENT,
    subject: `Database Recovered: "${instanceName}" is back online`,
    body: [`"${instanceName}" (${hostLabel}) is reachable again as of ${new Date().toISOString()}.`, "", "This is an automated alert from LogMonitor."].join("\n"),
  });
  if (!result.success) {
    console.error(`[sqlServerMonitoring] failed to send recovery-alert email for instance ${instanceId}: ${result.error}`);
  }

  await db
    .request()
    .input("id", sql.Int, instanceId)
    .query("UPDATE SqlServerInstances SET LastDownAlertAt = NULL WHERE Id = @id")
    .catch(() => {});
}
