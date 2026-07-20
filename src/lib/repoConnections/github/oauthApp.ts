// Named export shared between the /oauth/start and /oauth/callback route handlers - kept out
// of route.ts itself since the App Router only allows HTTP-verb/route-config exports there.
export const OAUTH_STATE_COOKIE = "cq_gh_oauth_state";

export interface OAuthAppConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// Returns null (never throws) when the three env vars aren't set, so every caller can render
// a clean "not configured yet" state instead of crashing - this method is opt-in per the
// admin's own GitHub OAuth App registration, not something that can work out of the box.
export function getOAuthAppConfig(): OAuthAppConfig | null {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthorizeUrl(config: OAuthAppConfig, state: string): string {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", "repo read:org");
  url.searchParams.set("state", state);
  return url.toString();
}

interface TokenResponse {
  access_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface ExchangedToken {
  accessToken: string;
  scopes: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

// Classic GitHub OAuth Apps issue a non-expiring token by default; only OAuth Apps that opt
// into "expiring user tokens" return refresh_token/expires_in. Both shapes are handled -
// refreshToken/expiresAt are simply null for the non-expiring case, and there is no automatic
// refresh flow yet (documented known limitation - a re-connect via /oauth/start is the
// workaround if a token is ever revoked or does expire).
export async function exchangeCodeForToken(config: OAuthAppConfig, code: string): Promise<ExchangedToken> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: config.redirectUri }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? `GitHub OAuth token exchange failed (${res.status}).`);
  }
  return {
    accessToken: data.access_token,
    scopes: data.scope ?? "",
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}
