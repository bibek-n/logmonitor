import { getDb, sql } from "../db";
import { sendSlackAlert, sendTeamsAlert, sendInAppAlert } from "../websiteApiMonitoring/alertChannels";

// Monitoring integration (Phase 3) - thin glue reusing the Slack/Teams/In-App notification
// senders already built for Website & API Monitoring (src/lib/websiteApiMonitoring/alertChannels.ts)
// and its shared AlertContacts table, rather than building a second notification system. The
// generic webhook sender there is skipped in favor of a plain fetch here - its signature bakes
// in a non-nullable monitorId that doesn't fit a Remote Access connection event.
async function resolveContacts(contactIds: number[]): Promise<{ id: number; contactType: string; destination: string }[]> {
  if (contactIds.length === 0) return [];
  const db = await getDb();
  const result = await db
    .request()
    .input("ids", sql.NVarChar, contactIds.join(","))
    .query<{ Id: number; ContactType: string; Destination: string }>(
      "SELECT Id, ContactType, Destination FROM AlertContacts WHERE IsActive = 1 AND Id IN (SELECT value FROM STRING_SPLIT(@ids, ','))"
    );
  return result.recordset.map((r) => ({ id: r.Id, contactType: r.ContactType, destination: r.Destination }));
}

export async function notifyRemoteAccessEvent(contactIdsCsv: string | null, subject: string, body: string): Promise<void> {
  if (!contactIdsCsv) return;
  const contactIds = contactIdsCsv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const contacts = await resolveContacts(contactIds);

  for (const contact of contacts) {
    try {
      if (contact.contactType === "Slack") await sendSlackAlert(contact.destination, subject, body);
      else if (contact.contactType === "Teams") await sendTeamsAlert(contact.destination, subject, body);
      else if (contact.contactType === "Webhook") {
        await fetch(contact.destination, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "remote-access", subject, body }),
          signal: AbortSignal.timeout(8000),
        }).catch(() => {});
      } else if (contact.contactType === "InApp") await sendInAppAlert(contact.destination, { eventType: "RemoteAccessConnectionStatus", subject, body, monitorId: null, incidentId: null });
    } catch {
      // Best-effort - a failed notification must never interrupt the connection-check loop.
    }
  }
}
