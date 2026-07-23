import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/agentAuth";
import { ensureAgentLogSource } from "@/lib/intrusionDetection/agentWebLogIngest";
import { ingestEvent } from "@/lib/intrusionDetection/collector";
import { loadEnabledRules, loadExclusions } from "@/lib/intrusionDetection/ruleEngine";
import { loadWebsiteAppsByHostname } from "@/lib/intrusionDetection/websiteSync";
import { recordCollectorHealth, markLogSourceHealthy, markLogSourceError } from "@/lib/intrusionDetection/store";
import type { NormalizedSecurityEvent } from "@/lib/intrusionDetection/shared";

// A batch this large would only happen from a misbehaving/misconfigured agent (the agent
// itself is expected to send small, frequent batches - see weblog_windows.go) - capped
// defensively so one bad actor can't turn its own request volume into an ingestion-endpoint
// overload on top of whatever it's already doing to the monitored site.
const MAX_EVENTS_PER_BATCH = 500;

interface RawAgentEvent {
  eventTime: string;
  sourceIp: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  responseStatus: number | null;
  userAgent: string | null;
  userAccount: string | null;
  timeTakenMs: number | null;
}

// Endpoint agents forward their own server's IIS access log here (see the DDoS Detection
// module's "all servers" follow-up) instead of this app reading remote log files over the
// network - the agent already has a trusted, authenticated channel to this server (the same
// API key every other agent endpoint uses), which a UNC/SMB path across untrusted machines
// does not. Always responds 200 (even on auth/validation failure) for the same reason every
// other agent endpoint does - see enroll/route.ts's comment on IIS replacing non-2xx bodies.
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" });
  }

  const body = await req.json().catch(() => null);
  const siteName = typeof body?.siteName === "string" && body.siteName.trim() ? body.siteName.trim() : null;
  const rawEvents = Array.isArray(body?.events) ? (body.events as RawAgentEvent[]) : null;
  if (!siteName || !rawEvents) {
    return NextResponse.json({ ok: false, error: "siteName and events are required" });
  }
  const events = rawEvents.slice(0, MAX_EVENTS_PER_BATCH);

  const startedAt = Date.now();
  let logSource;
  try {
    logSource = await ensureAgentLogSource(device.deviceId, device.hostname, siteName);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to register log source" });
  }

  try {
    const [rules, exclusions, websiteAppsByHostname] = await Promise.all([
      loadEnabledRules(),
      loadExclusions(),
      loadWebsiteAppsByHostname(),
    ]);

    let alertsCreated = 0;
    for (const raw of events) {
      const normalized: NormalizedSecurityEvent = {
        logSourceId: logSource.Id,
        protectedApplicationId: logSource.ProtectedApplicationId,
        dataSource: "iis_access_log",
        eventTime: raw.eventTime,
        sourceIp: raw.sourceIp,
        destinationHost: device.hostname,
        requestMethod: raw.requestMethod,
        requestPath: raw.requestPath,
        responseStatus: raw.responseStatus,
        userAgent: raw.userAgent,
        userAccount: raw.userAccount,
        evidenceSummary: null,
        fields: { timeTakenMs: raw.timeTakenMs },
      };
      const { alertCreated } = await ingestEvent(normalized, rules, exclusions, websiteAppsByHostname);
      if (alertCreated) alertsCreated++;
    }

    await Promise.all([
      recordCollectorHealth(logSource.Id, "Healthy", `${events.length} event(s) received from ${device.hostname}`, events.length, Date.now() - startedAt),
      markLogSourceHealthy(logSource.Id),
    ]);
    return NextResponse.json({ ok: true, accepted: events.length, alertsCreated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    await Promise.all([
      recordCollectorHealth(logSource.Id, "Failed", message, 0, Date.now() - startedAt),
      markLogSourceError(logSource.Id, message),
    ]);
    return NextResponse.json({ ok: false, error: message });
  }
}
