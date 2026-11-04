// AgentQA (agentqa.lovable.app) User Access API client - built directly against the vendor's
// own documentation (provided 2026-11-04), not guessed: a single POST endpoint, `x-api-key`
// auth, a body identifying the user by email or UUID plus a `disabled` boolean. Toggles sign-in
// only - the API itself is documented as never deleting the account or its data, so this never
// needs the "never delete" caveats the GitLab/Glesys clients have to engineer around themselves.
//
// Documented behavior worth relying on here: calling with the same `disabled` value twice is
// explicitly safe ("Repeats are safe... retrying a failed job is harmless"), so no idempotency
// guard is needed on this client's side - offboardingService.ts's own "don't re-run an already-
// Success step" check is enough. The API also protects one specific account (403, "super user")
// - that's surfaced as its own AgentQaApiError.status so the caller can treat it as "correctly
// protected," not a failure of this integration.

export class AgentQaApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "AgentQaApiError";
  }
}

export interface AgentQaResult {
  ok: true;
  user_id: string;
  email: string;
  disabled: boolean;
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error: unknown }).error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
    if (err !== undefined) return JSON.stringify(err);
  }
  return fallback;
}

export async function setUserAccess(
  apiUrl: string,
  apiKey: string,
  identifier: { email?: string; userId?: string },
  disabled: boolean
): Promise<AgentQaResult> {
  const body: Record<string, string | boolean> = { disabled };
  // "email wins if you send both" per the docs - only send one to keep the request unambiguous.
  if (identifier.email) body.email = identifier.email;
  else if (identifier.userId) body.user_id = identifier.userId;
  else throw new AgentQaApiError("No email or AgentQA user id available to identify this employee.", 400);

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });

  const parsed = await res.json().catch(() => null);
  if (!res.ok) {
    throw new AgentQaApiError(extractErrorMessage(parsed, `AgentQA API returned HTTP ${res.status}`), res.status);
  }
  return parsed as AgentQaResult;
}
