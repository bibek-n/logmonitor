import type { AuthenticatorTransportFuture, WebAuthnCredential } from "@simplewebauthn/server";
import { getDb, sql } from "./db";

// RP ID is the bare domain (no scheme/port) the passkey is bound to; origin is the exact
// scheme+host+port the browser sees. Both must match reality in production or every
// ceremony will fail verification. Overridable via env for local/dev testing against a
// different host.
export const RP_NAME = "LogMonitor";
export const RP_ID = process.env.WEBAUTHN_RP_ID || "logs.tulipshrm.com";
export const ORIGIN = process.env.WEBAUTHN_ORIGIN || "https://logs.tulipshrm.com:4433";

export const PASSKEY_CHALLENGE_COOKIE = "passkey_challenge";

export interface StoredPasskey {
  id: number;
  userId: number;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string | null;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

// next-auth v4's CredentialsProvider authorize() only exposes `headers` (raw, unparsed) on
// its request object, not a parsed `cookies` map — this pulls the challenge cookie out of
// the raw `Cookie:` header string ourselves.
export function readChallengeCookie(headers: Record<string, unknown> | Headers | undefined): string | null {
  if (!headers) return null;
  const raw = headers instanceof Headers ? headers.get("cookie") : (headers["cookie"] as string | undefined);
  if (!raw) return null;
  const match = raw.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${PASSKEY_CHALLENGE_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(PASSKEY_CHALLENGE_COOKIE.length + 1)) : null;
}

// TS 5.7+'s typed-array generics distinguish Uint8Array<ArrayBuffer> from the wider
// Uint8Array<ArrayBufferLike> that TextEncoder/Buffer actually produce — @simplewebauthn's
// types want the former. The underlying bytes are a real, non-shared ArrayBuffer at
// runtime either way, so this cast is safe.
export function userIdToHandle(userId: number): Uint8Array<ArrayBuffer> {
  return Buffer.from(String(userId), "utf8") as unknown as Uint8Array<ArrayBuffer>;
}

export function handleToUserId(handle: string): number | null {
  // userHandle arrives as a base64url string from the browser (per WebAuthn L3) — decode
  // back to the UTF-8 numeric id this app encoded it as at registration.
  const decoded = Buffer.from(handle, "base64url").toString("utf8");
  const id = Number(decoded);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function getPasskeysForUser(userId: number): Promise<StoredPasskey[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("userId", sql.Int, userId)
    .query<StoredPasskey>(
      "SELECT Id AS id, UserId AS userId, CredentialId AS credentialId, PublicKey AS publicKey, Counter AS counter, Transports AS transports, DeviceLabel AS deviceLabel, CreatedAt AS createdAt, LastUsedAt AS lastUsedAt FROM UserPasskeys WHERE UserId = @userId ORDER BY CreatedAt DESC"
    );
  return result.recordset;
}

export async function getPasskeyByCredentialId(credentialId: string): Promise<StoredPasskey | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("credentialId", sql.NVarChar, credentialId)
    .query<StoredPasskey>(
      "SELECT Id AS id, UserId AS userId, CredentialId AS credentialId, PublicKey AS publicKey, Counter AS counter, Transports AS transports, DeviceLabel AS deviceLabel, CreatedAt AS createdAt, LastUsedAt AS lastUsedAt FROM UserPasskeys WHERE CredentialId = @credentialId"
    );
  return result.recordset[0] ?? null;
}

export function toWebAuthnCredential(row: StoredPasskey): WebAuthnCredential {
  return {
    id: row.credentialId,
    publicKey: new Uint8Array(Buffer.from(row.publicKey, "base64")),
    counter: row.counter,
    transports: row.transports ? (row.transports.split(",") as AuthenticatorTransportFuture[]) : undefined,
  };
}

export async function updatePasskeyCounter(credentialId: string, newCounter: number): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("credentialId", sql.NVarChar, credentialId)
    .input("counter", sql.BigInt, newCounter)
    .query("UPDATE UserPasskeys SET Counter = @counter, LastUsedAt = SYSUTCDATETIME() WHERE CredentialId = @credentialId");
}
