import { getDb, sql } from "../db";
import { getNotificationSettings, fanOutNotification, recordScoreDropAlertSent } from "@/lib/intrusionDetection/notificationChannels";

// "Alert on drop: Notify if the score falls by more than a set amount in a day." Reuses the
// Intrusion Detection module's notification channels/settings (SecurityNotificationSettings,
// SecurityNotificationChannels) rather than building a parallel channel system just for this -
// Security Center is the umbrella view over Intrusion Detection, Vulnerability Scanner, Malware
// Detection etc. already, so cross-referencing that module's channels from here is consistent
// with that relationship, not a layering violation.
//
// Called once per hourly snapshot run (scripts/run-security-center-snapshot.ts) rather than its
// own scheduled task. Debounced to at most one notification per 24 hours (LastScoreDropAlertAt)
// so a score that stays low doesn't re-page every single hour it's re-evaluated.
export async function checkForScoreDrop(currentScore: number): Promise<void> {
  const settings = await getNotificationSettings();

  if (settings.lastScoreDropAlertAt && Date.now() - new Date(settings.lastScoreDropAlertAt).getTime() < 24 * 60 * 60 * 1000) return;

  const db = await getDb();
  const dayAgo = await db
    .request()
    .input("since", sql.DateTime2, new Date(Date.now() - 24 * 60 * 60 * 1000))
    .query<{ OverallScore: number; SnapshotAt: string }>(
      "SELECT TOP 1 OverallScore, CONVERT(VARCHAR(19), SnapshotAt, 126) AS SnapshotAt FROM SecurityCenterScoreSnapshots WHERE SnapshotAt <= @since ORDER BY SnapshotAt DESC"
    );
  const previous = dayAgo.recordset[0];
  if (!previous) return; // not enough history yet (first ~24h after this feature ships)

  const drop = previous.OverallScore - currentScore;
  if (drop < settings.scoreDropThreshold) return;

  await fanOutNotification(
    "Security Score dropped",
    `The overall Security Score fell from ${previous.OverallScore} to ${currentScore} (-${drop} point(s)) over the last 24 hours (since ${previous.SnapshotAt}). Review the Security Center dashboard for which category is responsible.`
  );
  await recordScoreDropAlertSent();
}
