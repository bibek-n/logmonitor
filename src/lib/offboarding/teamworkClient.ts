// Teamwork (teamwork.websearchpro.net) access-revocation client. Built from a single example
// call, not a full documented spec - no status-code table, no documented response body shape.
//
// `request_id` is caller-supplied, not generated here - confirmed live (2026-11-04) via the
// API's own error response on a failed call ("Could not revoke access; retry with the same
// request_id") that it must stay STABLE across retries of the same attempt, contradicting the
// "fresh random UUID per call, no special meaning" assumption this was first built under.
// offboardingService.ts now generates exactly one UUID per OffboardingActions row (at creation)
// and passes it in here on every call made while retrying that row.
//
// `action` is a REQUIRED field this endpoint rejects calls without ({"error":"Required",
// "code":"invalid_request"}) - missed entirely in the original build since the one example call
// provided didn't include it. Confirmed live (2026-11-04) with a real successful call that also
// showed the endpoint supports action:"enable", not just "disable" - so re-enabling access IS
// possible through this same API after all, contrary to what was assumed/documented earlier.

export class TeamworkApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "TeamworkApiError";
  }
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const maybeError = (body as Record<string, unknown>).error ?? (body as Record<string, unknown>).message;
    if (typeof maybeError === "string") return maybeError;
  }
  return fallback;
}

async function callTeamworkAccessApi(apiUrl: string, apiKey: string, email: string, action: "disable" | "enable", requestId: string, reason: string): Promise<Record<string, unknown>> {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, action, request_id: requestId, reason }),
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Response wasn't JSON - fall through, the HTTP status still tells us success/failure.
  }

  if (!res.ok) {
    throw new TeamworkApiError(extractErrorMessage(parsed, `Teamwork API returned HTTP ${res.status}`), res.status);
  }
  return (parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {});
}

export async function revokeUserAccess(apiUrl: string, apiKey: string, email: string, requestId: string, reason: string): Promise<Record<string, unknown>> {
  return callTeamworkAccessApi(apiUrl, apiKey, email, "disable", requestId, reason);
}

export async function restoreUserAccess(apiUrl: string, apiKey: string, email: string, requestId: string, reason: string): Promise<Record<string, unknown>> {
  return callTeamworkAccessApi(apiUrl, apiKey, email, "enable", requestId, reason);
}
