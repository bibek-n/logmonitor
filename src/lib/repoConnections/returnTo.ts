const DEFAULT_RETURN_TO = "/dashboard/settings/integrations/git";

// Every module's Add Project page links to /oauth/start or /app/install with ?returnTo=<its
// own URL>, so the callback can send the admin back to wherever they started instead of always
// landing on the central connections page - this is the actual "universal" part: the OAuth/App
// flow itself doesn't know or care which module initiated it. Restricted to same-origin
// /dashboard/ paths only, to rule out an open-redirect via a crafted query param.
export function sanitizeReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith("/dashboard/") || raw.includes("://") || raw.startsWith("//")) return DEFAULT_RETURN_TO;
  return raw;
}

// Packed into a single cookie value (rather than two cookies) so start/callback only ever
// need to coordinate on one piece of state.
export function packState(state: string, returnTo: string): string {
  return `${state}|${returnTo}`;
}

export function unpackState(value: string | undefined): { state: string; returnTo: string } | null {
  if (!value) return null;
  const sepIndex = value.indexOf("|");
  if (sepIndex === -1) return null;
  return { state: value.slice(0, sepIndex), returnTo: sanitizeReturnTo(value.slice(sepIndex + 1)) };
}
