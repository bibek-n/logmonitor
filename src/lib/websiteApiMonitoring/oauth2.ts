import https from "https";
import { getDb, sql } from "../db";
import { encrypt, decrypt } from "./apiCredentials";

const TOKEN_EXPIRY_BUFFER_MS = 30_000; // renew a little before the token actually expires, not exactly at expiry
const TOKEN_REQUEST_TIMEOUT_MS = 10_000;

interface ClientCredentialsConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string | null;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
}

export function requestClientCredentialsToken(config: ClientCredentialsConfig): Promise<{ accessToken: string; expiresInSeconds: number }> {
  return new Promise((resolve, reject) => {
    const u = new URL(config.tokenUrl);
    const params = new URLSearchParams({ grant_type: "client_credentials" });
    if (config.scope) params.set("scope", config.scope);
    const bodyStr = params.toString();
    const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

    const req = https.request(
      config.tokenUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(bodyStr),
          Accept: "application/json",
        },
        timeout: TOKEN_REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Token endpoint ${u.hostname} returned HTTP ${res.statusCode}.`));
            return;
          }
          try {
            const parsed: TokenResponse = JSON.parse(body);
            if (!parsed.access_token) throw new Error("Token response had no access_token field.");
            resolve({ accessToken: parsed.access_token, expiresInSeconds: parsed.expires_in ?? 3600 });
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Token request timed out.")));
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

// Each scheduled scan run is a fresh `tsx` process (this app's established scheduled-job
// convention - see the plan's job-queue correction), so an in-memory token cache alone would
// never survive between checks and every check would re-authenticate against the token
// endpoint for no reason. The token is cached in ApiMonitorConfigs itself (encrypted, alongside
// the rest of the monitor's own auth secret) and reused across runs until it's within
// TOKEN_EXPIRY_BUFFER_MS of expiring.
export async function getOAuth2AccessToken(monitorId: number, config: ClientCredentialsConfig): Promise<string> {
  // monitorId 0 means "not a saved monitor yet" (the Test Monitor preview on the create form,
  // before the row exists) - there's nowhere to cache a token, so just fetch one fresh every
  // time rather than reading/writing a MonitorId that doesn't exist.
  if (!monitorId) {
    return (await requestClientCredentialsToken(config)).accessToken;
  }

  const db = await getDb();
  const cached = await db
    .request()
    .input("monitorId", sql.Int, monitorId)
    .query<{ CachedOAuthTokenEncrypted: string | null; CachedOAuthTokenExpiresAt: string | null }>(
      "SELECT CachedOAuthTokenEncrypted, CachedOAuthTokenExpiresAt FROM ApiMonitorConfigs WHERE MonitorId = @monitorId"
    );
  const row = cached.recordset[0];
  if (row?.CachedOAuthTokenEncrypted && row.CachedOAuthTokenExpiresAt) {
    const expiresAt = new Date(row.CachedOAuthTokenExpiresAt).getTime();
    if (expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now()) {
      return decrypt(row.CachedOAuthTokenEncrypted);
    }
  }

  const { accessToken, expiresInSeconds } = await requestClientCredentialsToken(config);
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  await db
    .request()
    .input("monitorId", sql.Int, monitorId)
    .input("token", sql.NVarChar(sql.MAX), encrypt(accessToken))
    .input("expiresAt", sql.DateTime2, expiresAt)
    .query("UPDATE ApiMonitorConfigs SET CachedOAuthTokenEncrypted = @token, CachedOAuthTokenExpiresAt = @expiresAt WHERE MonitorId = @monitorId");

  return accessToken;
}
