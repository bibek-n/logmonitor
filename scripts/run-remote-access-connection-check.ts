import "dotenv/config";
import { checkTcpReachability } from "../src/lib/remoteAccess/connectionService";
import { getSettings, listConnectionsForCheck, recordConnectionCheckResult } from "../src/lib/remoteAccess/repository";
import { notifyRemoteAccessEvent } from "../src/lib/remoteAccess/notifications";

// The concrete fix for the "AvailabilityStatus never updates" failure class flagged in the
// approved plan's Context section (a direct lesson from this session's Website Monitoring
// stale-status bug report) - this runs on a real Windows Scheduled Task on a fixed interval,
// not just when someone happens to click "Test Connection". Uses the exact same
// checkTcpReachability()/recordConnectionCheckResult() functions the manual Test Connection
// button calls, so there is only one reachability implementation to keep correct.
async function main() {
  const connections = await listConnectionsForCheck();
  console.log(`Remote Access Connection Checker: ${connections.length} connection(s) due.`);

  // Monitoring integration (Phase 3): notify only on a genuine status TRANSITION (not every
  // single check), reusing the Website & API Monitoring notification senders via
  // notifyRemoteAccessEvent - see src/lib/remoteAccess/notifications.ts.
  const settings = await getSettings();
  let online = 0;
  let offline = 0;

  for (const conn of connections) {
    const host = conn.hostname || conn.ipAddress;
    if (!host) {
      console.warn(`Connection #${conn.id} has no hostname or IP address - skipping.`);
      continue;
    }
    try {
      const result = await checkTcpReachability(host, conn.port, conn.timeoutSeconds * 1000);
      await recordConnectionCheckResult(conn.id, result.status, result.latencyMs, result.errorMessage);
      if (result.status === "Online") online++;
      else offline++;

      if (result.status !== conn.previousStatus && (result.status === "Offline" || conn.previousStatus === "Offline")) {
        const subject = result.status === "Offline" ? `Remote Access connection down: ${conn.name}` : `Remote Access connection recovered: ${conn.name}`;
        const body = `${conn.name} (${host}:${conn.port}, ${conn.protocol}) is now ${result.status}.${result.errorMessage ? ` ${result.errorMessage}` : ""}`;
        await notifyRemoteAccessEvent(settings.notifyOnConnectionOfflineContactIds, subject, body);
      }
    } catch (err) {
      console.error(`Connection check failed for #${conn.id} (${host}:${conn.port}):`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`Remote Access Connection Checker: ${online} online, ${offline} offline/unreachable.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
