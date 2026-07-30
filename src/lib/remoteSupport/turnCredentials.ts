import crypto from "crypto";
import type { IceServerConfig } from "./types";

// Standard coturn "REST API" long-term-credential mechanism (widely supported, not something
// this module invented): username is "<expiry-unix-ts>:<label>", password is
// base64(HMAC-SHA1(sharedSecret, username)). coturn validates the same way, so credentials
// self-expire without either side needing to revoke them - by the time a session ends,
// whatever credential it handed out naturally stops working within `ttlSeconds` regardless.
const TURN_SHARED_SECRET = process.env.REMOTE_SUPPORT_TURN_SECRET;
const TURN_URLS = (process.env.REMOTE_SUPPORT_TURN_URLS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const STUN_URLS = (process.env.REMOTE_SUPPORT_STUN_URLS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const DEFAULT_TTL_SECONDS = 60 * 60; // generous ceiling; the session itself is the real expiry

export interface TurnCredentialResult {
  iceServers: IceServerConfig[];
}

// Returns null (not a thrown error) when TURN isn't configured yet - callers fall back to
// STUN-only ICE servers, which still works for plenty of NAT setups; TURN is only strictly
// required for symmetric-NAT/restrictive-firewall cases (see Phase 5 deployment notes).
export function issueTurnCredential(sessionId: number, ttlSeconds: number = DEFAULT_TTL_SECONDS): TurnCredentialResult {
  const iceServers: IceServerConfig[] = [];

  if (STUN_URLS.length > 0) {
    iceServers.push({ urls: STUN_URLS });
  }

  if (TURN_SHARED_SECRET && TURN_URLS.length > 0) {
    const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
    const username = `${expiry}:remote-support-session-${sessionId}`;
    const credential = crypto.createHmac("sha1", TURN_SHARED_SECRET).update(username).digest("base64");
    iceServers.push({ urls: TURN_URLS, username, credential });
  }

  return { iceServers };
}
