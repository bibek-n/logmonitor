import webpush from "web-push";
import { getDb, sql } from "./db";

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let cachedKeys: VapidKeys | null = null;

// Cached for the life of the Node process - VAPID keys are generated once at migration time
// and never rotated, so there's no reason to hit the DB on every push send.
async function getVapidKeys(): Promise<VapidKeys | null> {
  if (cachedKeys) return cachedKeys;
  try {
    const db = await getDb();
    const result = await db.query<{ VapidPublicKey: string; VapidPrivateKey: string }>(
      "SELECT VapidPublicKey, VapidPrivateKey FROM PushSettings WHERE Id = 1"
    );
    const row = result.recordset[0];
    if (!row) return null;
    cachedKeys = { publicKey: row.VapidPublicKey, privateKey: row.VapidPrivateKey };
    return cachedKeys;
  } catch {
    // Table doesn't exist yet (migration not run) - treat push as simply unavailable rather
    // than throwing, same defensive posture as bandwidthQuota.ts after the earlier incident.
    return null;
  }
}

export async function getVapidPublicKey(): Promise<string | null> {
  const keys = await getVapidKeys();
  return keys?.publicKey ?? null;
}

// The WebPush protocol requires a "subject" (a mailto: or https: contact) so a push service can
// reach the sender if something's wrong with how it's sending notifications - it's metadata read
// by push services, not an address real users ever see. Was hardcoded to this deployment's own
// admin address; now reads the configured Contact Email (Settings > Company Profile), falling
// back to a syntactically-valid but clearly generic placeholder only if that's never been set.
async function getVapidSubject(): Promise<string> {
  try {
    const db = await getDb();
    const result = await db.query<{ ContactEmail: string | null }>`SELECT ContactEmail FROM CompanySettings WHERE Id = 1`;
    const email = result.recordset[0]?.ContactEmail;
    return email ? `mailto:${email}` : "mailto:admin@example.com";
  } catch {
    return "mailto:admin@example.com";
  }
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSubscription(userId: number, sub: PushSubscriptionInput): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("userId", sql.Int, userId)
    .input("endpoint", sql.NVarChar, sub.endpoint)
    .input("p256dh", sql.NVarChar, sub.keys.p256dh)
    .input("auth", sql.NVarChar, sub.keys.auth)
    .query(`
      MERGE PushSubscriptions AS target
      USING (SELECT @endpoint AS Endpoint) AS src
      ON target.Endpoint = src.Endpoint
      WHEN MATCHED THEN UPDATE SET UserId = @userId, P256dh = @p256dh, Auth = @auth
      WHEN NOT MATCHED THEN INSERT (UserId, Endpoint, P256dh, Auth) VALUES (@userId, @endpoint, @p256dh, @auth);
    `);
}

export async function removeSubscriptionByEndpoint(endpoint: string): Promise<void> {
  const db = await getDb();
  await db.request().input("endpoint", sql.NVarChar, endpoint).query("DELETE FROM PushSubscriptions WHERE Endpoint = @endpoint");
}

// Fire-and-forget from notifyEmail.ts's sendNotificationEmail, same pattern as
// sendWebhookNotification - never throws, silently does nothing if push isn't set up
// (migration not run) or there are no subscribers yet.
export async function sendPushNotification(subject: string, body: string): Promise<void> {
  const keys = await getVapidKeys();
  if (!keys) return;

  webpush.setVapidDetails(await getVapidSubject(), keys.publicKey, keys.privateKey);

  const db = await getDb();
  const result = await db.query<{ Id: number; Endpoint: string; P256dh: string; Auth: string }>(
    "SELECT Id, Endpoint, P256dh, Auth FROM PushSubscriptions"
  );

  const payload = JSON.stringify({ title: "LogMonitor", body: `${subject}\n${body}`.slice(0, 500) });

  await Promise.all(
    result.recordset.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.Endpoint, keys: { p256dh: row.P256dh, auth: row.Auth } },
          payload
        );
      } catch (err) {
        // 404/410 = the browser unsubscribed or the subscription expired - clean it up so
        // future sends don't keep retrying a dead endpoint. Any other error (network blip,
        // etc.) is left alone to retry next time.
        const statusCode = (err as { statusCode?: number } | null)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await removeSubscriptionByEndpoint(row.Endpoint).catch(() => {});
        }
      }
    })
  );
}
