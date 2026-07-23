import { ADAPTERS } from "./adapters";
import { getEnabledLogSources, insertSecurityEvent, updateLogSourcePosition, markLogSourceError, recordCollectorHealth, type LogSourceRow } from "./store";
import { loadEnabledRules, loadExclusions, evaluateRulesForEvent } from "./ruleEngine";
import { processMatch } from "./alertManager";
import { syncProtectedWebsites, loadWebsiteAppsByHostname } from "./websiteSync";
import type { NormalizedSecurityEvent } from "./shared";

export interface CollectorRunSummary {
  logSourceName: string;
  eventsProcessed: number;
  alertsCreated: number;
  status: "Healthy" | "Degraded" | "Failed";
  message: string | null;
}

// One full pass: for every enabled log source, collect new events since its stored
// position, persist them, run every enabled detection rule against each, and hand any
// matches to the alert manager. Loads rules/exclusions once per run (not per event) since
// they rarely change between collector runs and re-querying per event would be wasteful at
// "thousands of events per run" scale.
export async function runCollectionPass(): Promise<CollectorRunSummary[]> {
  // Keeps SecurityProtectedApplications in sync with the app's Websites list before this
  // pass reads it, so a website added/removed via the existing website admin page takes
  // effect within one collection interval - no separate sync schedule to maintain.
  await syncProtectedWebsites();

  const [logSources, rules, exclusions, websiteAppsByHostname] = await Promise.all([
    getEnabledLogSources(),
    loadEnabledRules(),
    loadExclusions(),
    loadWebsiteAppsByHostname(),
  ]);

  const summaries: CollectorRunSummary[] = [];

  // AgentWebLog sources are push-based (an endpoint agent forwards its own web log directly
  // to /api/agent/weblog-events - see agentWebLogIngest.ts), not pulled by this scheduled
  // pass, and have no entry in ADAPTERS by design - skip them here rather than let
  // runOneLogSource mark them "Failed" every pass for lacking a pull adapter that was never
  // supposed to exist. Their own health is recorded directly by the ingestion route instead.
  for (const logSource of logSources) {
    if (logSource.AdapterType === "AgentWebLog") continue;
    const summary = await runOneLogSource(logSource, rules, exclusions, websiteAppsByHostname);
    summaries.push(summary);
  }

  return summaries;
}

// The per-event body of the pipeline (attribute -> insert -> evaluate -> alert), extracted so
// a push-based source (an agent forwarding its own web log, see agentWebLogIngest.ts) can run
// the exact same detection path a pull-based adapter's events go through in runOneLogSource
// below, rather than a second, easily-drifting copy of this logic.
export async function ingestEvent(
  rawEvent: NormalizedSecurityEvent,
  rules: Awaited<ReturnType<typeof loadEnabledRules>>,
  exclusions: Awaited<ReturnType<typeof loadExclusions>>,
  websiteAppsByHostname: Map<string, number>
): Promise<{ eventId: number; alertCreated: boolean }> {
  const event = attributeToWebsite(rawEvent, websiteAppsByHostname);
  const eventId = await insertSecurityEvent(event);
  const matches = await evaluateRulesForEvent(event, rules, exclusions);
  let alertCreated = false;
  for (const match of matches) {
    const alertId = await processMatch(match, event, eventId);
    if (alertId) alertCreated = true;
  }
  return { eventId, alertCreated };
}

function attributeToWebsite(event: NormalizedSecurityEvent, websiteAppsByHostname: Map<string, number>): NormalizedSecurityEvent {
  if (!event.destinationHost) return event;
  const hostname = event.destinationHost.toLowerCase().replace(/^www\./, "");
  const matchedAppId = websiteAppsByHostname.get(hostname);
  if (!matchedAppId) return event;
  // A specific protected website beats the adapter's default (e.g. the generic "Sophos
  // Firewall" bucket) - this is what lets web-filter traffic targeting an audited website
  // show up under that website in the dashboard instead of lumped as generic firewall noise.
  return { ...event, protectedApplicationId: matchedAppId };
}

async function runOneLogSource(
  logSource: LogSourceRow,
  rules: Awaited<ReturnType<typeof loadEnabledRules>>,
  exclusions: Awaited<ReturnType<typeof loadExclusions>>,
  websiteAppsByHostname: Map<string, number>
): Promise<CollectorRunSummary> {
  const startedAt = Date.now();
  const adapter = ADAPTERS[logSource.AdapterType];
  if (!adapter) {
    const message = `No adapter registered for AdapterType "${logSource.AdapterType}"`;
    await recordCollectorHealth(logSource.Id, "Failed", message, 0, Date.now() - startedAt);
    return { logSourceName: logSource.Name, eventsProcessed: 0, alertsCreated: 0, status: "Failed", message };
  }

  try {
    const result = await adapter(logSource);
    let alertsCreated = 0;

    for (const rawEvent of result.events) {
      const { alertCreated } = await ingestEvent(rawEvent, rules, exclusions, websiteAppsByHostname);
      if (alertCreated) alertsCreated++;
    }

    if ("newFileSize" in result && result.newFileSize !== undefined) {
      await updateLogSourcePosition(logSource.Id, result.newPositionFile ?? logSource.LastPositionFile ?? "", result.newPosition, result.newFileSize);
    } else {
      // DB-cursor adapters don't have a file/size concept - store the cursor position with
      // a 0 file size sentinel (unused for this adapter type, but the column is NOT NULL-
      // free either way since LastFileSize is nullable).
      await updateLogSourcePosition(logSource.Id, "", result.newPosition, 0);
    }

    const status = "Healthy";
    const message = `${result.events.length} event(s) processed, ${alertsCreated} alert(s) created/updated`;
    await recordCollectorHealth(logSource.Id, status, message, result.events.length, Date.now() - startedAt);
    return { logSourceName: logSource.Name, eventsProcessed: result.events.length, alertsCreated, status, message };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown collector error";
    await markLogSourceError(logSource.Id, message);
    await recordCollectorHealth(logSource.Id, "Failed", message, 0, Date.now() - startedAt);
    return { logSourceName: logSource.Name, eventsProcessed: 0, alertsCreated: 0, status: "Failed", message };
  }
}

// Exported for a future unit test / manual REPL check against a hand-built event, bypassing
// the DB entirely - useful for rule-authoring without needing a real log source.
export async function evaluateSingleEvent(event: NormalizedSecurityEvent) {
  const [rules, exclusions] = await Promise.all([loadEnabledRules(), loadExclusions()]);
  return evaluateRulesForEvent(event, rules, exclusions);
}
