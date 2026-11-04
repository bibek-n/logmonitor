import crypto from "crypto";

// Glesys Email API client, scoped to exactly what offboarding needs. Built against Glesys's
// documented REST shape (POST-only endpoints under https://api.glesys.com/email/<action>,
// HTTP Basic Auth with the API user + API key, JSON responses wrapped in
// { "response": { "status": { "code", "text" }, ...payload } }) - NOT verified against a live
// Glesys account in this session (no test credentials/domain were available), so treat this as
// implemented-to-spec rather than field-tested; confirm against a real account before relying on
// it for a real offboarding.
//
// Glesys's documented email API has account listing, creation, editing, deletion, and password
// changes - but no dedicated "disable login"/"suspend mailbox" action (confirmed by the module
// spec this was built from, and consistent with Glesys's published API reference). The safe,
// non-destructive fallback this client implements is exactly what was asked for: reset the
// mailbox's password to a long random value nobody is told, via the documented
// `email/editaccount` action. That revokes the former employee's ability to log in (IMAP/POP/
// webmail all require the password) while leaving every message and folder untouched for a
// manager to access later (the new password can be looked up again by an admin at handoff time -
// see offboardingService.ts, which stores it encrypted for exactly that purpose). This is
// reported to the caller as "ManualActionRequired", never as a true account suspension, because
// it is a password reset standing in for suspension, not suspension itself - anything exposed
// via alias lists, forwarding rules, or app-specific passwords elsewhere still needs a human to
// check.

const GLESYS_API_BASE = "https://api.glesys.com";

export class GlesysApiError extends Error {
  constructor(message: string, public code: number) {
    super(message);
    this.name = "GlesysApiError";
  }
}

async function glesysRequest<T>(apiUser: string, apiKey: string, action: string, params: Record<string, string>): Promise<T> {
  const auth = Buffer.from(`${apiUser}:${apiKey}`).toString("base64");
  const res = await fetch(`${GLESYS_API_BASE}/email/${action}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params).toString(),
  });

  const body = await res.text();
  let parsed: { response?: { status?: { code?: number; text?: string } } } = {};
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    throw new GlesysApiError(`Glesys API ${action} returned a non-JSON response (HTTP ${res.status}): ${body.slice(0, 300)}`, res.status);
  }

  const statusCode = parsed.response?.status?.code ?? res.status;
  if (statusCode < 200 || statusCode >= 300) {
    throw new GlesysApiError(`Glesys API ${action} failed: ${parsed.response?.status?.text ?? `HTTP ${res.status}`}`, statusCode);
  }

  return parsed.response as T;
}

export interface GlesysEmailAccount {
  emailaccount: string; // full address, e.g. "jane.doe@company.com"
  quota: string;
  antispamlevel: string;
  antispamaction: string;
  autorespond: string;
  created: string;
}

export async function listEmailAccounts(apiUser: string, apiKey: string, domain: string): Promise<GlesysEmailAccount[]> {
  const result = await glesysRequest<{ emailaccounts?: GlesysEmailAccount[] }>(apiUser, apiKey, "list", { domainname: domain });
  return result.emailaccounts ?? [];
}

export async function findEmailAccount(apiUser: string, apiKey: string, emailAddress: string): Promise<GlesysEmailAccount | null> {
  const domain = emailAddress.split("@")[1];
  if (!domain) throw new GlesysApiError(`"${emailAddress}" is not a valid email address.`, 400);
  const accounts = await listEmailAccounts(apiUser, apiKey, domain);
  return accounts.find((a) => a.emailaccount.toLowerCase() === emailAddress.toLowerCase()) ?? null;
}

/** Generates a password the former employee is never told - the lockout mechanism itself. */
export function generateRandomPassword(): string {
  return crypto.randomBytes(24).toString("base64url");
}

// The disable-fallback described in the class comment: resets the mailbox's password via the
// documented `email/editaccount` action. Idempotent in effect (safe to call again - it always
// sets a fresh unknown password, never fails because "already reset").
export async function resetMailboxPassword(apiUser: string, apiKey: string, emailAddress: string, newPassword: string): Promise<void> {
  await glesysRequest<unknown>(apiUser, apiKey, "editaccount", { emailaccount: emailAddress, password: newPassword });
}
