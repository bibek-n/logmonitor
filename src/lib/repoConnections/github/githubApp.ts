import { SignJWT, importPKCS8 } from "jose";

// Named export shared between the /app/install and /app/callback route handlers - kept out of
// route.ts itself since the App Router only allows HTTP-verb/route-config exports there.
export const APP_STATE_COOKIE = "cq_gh_app_state";

export interface GitHubAppConfig {
  appId: string;
  slug: string;
  privateKeyPem: string;
}

// Returns null (never throws) when the App isn't registered yet, mirroring
// oauthApp.ts's getOAuthAppConfig() - every caller renders a clean "not configured" state
// instead of crashing. GITHUB_APP_PRIVATE_KEY is the App's PEM private key with literal "\n"
// sequences (env vars can't hold real newlines), unescaped back to real newlines here.
export function getGitHubAppConfig(): GitHubAppConfig | null {
  const appId = process.env.GITHUB_APP_ID;
  const slug = process.env.GITHUB_APP_SLUG;
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !slug || !rawKey) return null;
  return { appId, slug, privateKeyPem: rawKey.replace(/\\n/g, "\n") };
}

export function buildInstallUrl(config: GitHubAppConfig, state: string): string {
  const url = new URL(`https://github.com/apps/${config.slug}/installations/new`);
  url.searchParams.set("state", state);
  return url.toString();
}

// Short-lived (10 min) App-level JWT, signed with the App's own private key - identifies the
// App itself, not any specific installation. Used only to mint per-installation access tokens
// (mintInstallationToken below) and to look up an installation's account login; never stored,
// re-minted on every use.
async function mintAppJwt(config: GitHubAppConfig): Promise<string> {
  const key = await importPKCS8(config.privateKeyPem, "RS256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now - 60) // allow for clock drift between this server and GitHub's
    .setExpirationTime(now + 570) // GitHub's own ceiling is 10 minutes
    .setIssuer(config.appId)
    .sign(key);
}

interface InstallationTokenResponse {
  token: string;
  expires_at: string;
}

// The token this actually returns is what gets used for repo access (client.ts /
// sync.ts) - scoped to exactly the repos the installation was granted, expires in ~1 hour,
// and is never persisted to the database (see crypto.ts's comment on why GitHubApp
// connections have no AccessTokenEncrypted value).
export async function mintInstallationToken(config: GitHubAppConfig, installationId: number): Promise<{ token: string; expiresAt: Date }> {
  const appJwt = await mintAppJwt(config);
  const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${appJwt}`, Accept: "application/vnd.github+json", "User-Agent": "LogMonitor-CodeQuality", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to mint installation token for installation ${installationId}: ${res.status} ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as InstallationTokenResponse;
  return { token: data.token, expiresAt: new Date(data.expires_at) };
}

interface InstallationResponse {
  account: { login: string } | null;
}

export async function getInstallationOwnerLogin(config: GitHubAppConfig, installationId: number): Promise<string | null> {
  const appJwt = await mintAppJwt(config);
  const res = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: { Authorization: `Bearer ${appJwt}`, Accept: "application/vnd.github+json", "User-Agent": "LogMonitor-CodeQuality", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as InstallationResponse;
  return data.account?.login ?? null;
}
