// Minimal GitLab Self-Managed admin REST client, scoped to exactly what offboarding needs:
// search/look up users, block a user (GET/PUT /users/:id, POST /users/:id/block), and revoke
// that user's personal access tokens. Mirrors src/lib/repoConnections/gitlab/client.ts's shape
// (own GitLabApiError, instanceUrl passed explicitly since every self-managed instance is a
// different origin, PRIVATE-TOKEN auth header) but is a separate module - that one is scoped to
// Code Quality's per-project sync connections with a narrower credential model, this one needs
// instance-wide admin privileges (user administration), a meaningfully different trust level.
//
// GitLab has no separate "revoke all sessions" admin endpoint - blocking a user
// (state=blocked) is itself what invalidates further authentication; GitLab's own
// authentication middleware rejects a blocked user on every subsequent request, web or API.
// This client does not claim to call a session-revocation endpoint that doesn't exist.

export class GitLabAdminApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "GitLabAdminApiError";
  }
}

function apiBase(instanceUrl: string): string {
  return `${instanceUrl.replace(/\/+$/, "")}/api/v4`;
}

function authHeaders(token: string): HeadersInit {
  return { "PRIVATE-TOKEN": token };
}

async function gitlabRequest<T>(instanceUrl: string, path: string, token: string, method: "GET" | "POST" | "DELETE" = "GET"): Promise<T> {
  const res = await fetch(`${apiBase(instanceUrl)}${path}`, { method, headers: authHeaders(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GitLabAdminApiError(`GitLab admin API ${method} ${path} returned ${res.status}: ${body.slice(0, 300)}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface GitLabAdminUser {
  id: number;
  username: string;
  name: string;
  email: string | null;
  state: string; // "active" | "blocked" | "deactivated" | "ldap_blocked" | ...
}

interface RawAdminUser {
  id: number;
  username: string;
  name: string;
  email: string | null;
  state: string;
}

function toAdminUser(u: RawAdminUser): GitLabAdminUser {
  return { id: u.id, username: u.username, name: u.name, email: u.email, state: u.state };
}

/** Verifies the token itself has admin access (used when saving module settings). */
export async function verifyAdminToken(instanceUrl: string, token: string): Promise<GitLabAdminUser> {
  const user = await gitlabRequest<RawAdminUser & { is_admin?: boolean }>(instanceUrl, "/user", token);
  if (!user.is_admin) {
    throw new GitLabAdminApiError("This token's user is not a GitLab administrator - offboarding needs an admin token to block users.", 403);
  }
  return toAdminUser(user);
}

export async function searchUsers(instanceUrl: string, token: string, query: string): Promise<GitLabAdminUser[]> {
  const raw = await gitlabRequest<RawAdminUser[]>(instanceUrl, `/users?search=${encodeURIComponent(query)}&per_page=20`, token);
  return raw.map(toAdminUser);
}

export async function getUser(instanceUrl: string, token: string, userId: number): Promise<GitLabAdminUser> {
  const raw = await gitlabRequest<RawAdminUser>(instanceUrl, `/users/${userId}`, token);
  return toAdminUser(raw);
}

// Idempotent by design: GitLab's own API returns 403 "already blocked" if called on an
// already-blocked user - treated as success here (not re-throwing), since the end state the
// caller actually wants (this account cannot log in) is already true. A genuinely different
// failure (user not found, insufficient permissions, network error) still throws normally.
export async function blockUser(instanceUrl: string, token: string, userId: number): Promise<{ alreadyBlocked: boolean }> {
  try {
    await gitlabRequest<void>(instanceUrl, `/users/${userId}/block`, token, "POST");
    return { alreadyBlocked: false };
  } catch (err) {
    if (err instanceof GitLabAdminApiError && err.status === 403 && /already blocked/i.test(err.message)) {
      return { alreadyBlocked: true };
    }
    throw err;
  }
}

export async function unblockUser(instanceUrl: string, token: string, userId: number): Promise<void> {
  await gitlabRequest<void>(instanceUrl, `/users/${userId}/unblock`, token, "POST");
}

export interface GitLabPersonalAccessToken {
  id: number;
  name: string;
  revoked: boolean;
  active: boolean;
}

export async function listPersonalAccessTokens(instanceUrl: string, token: string, userId: number): Promise<GitLabPersonalAccessToken[]> {
  const raw = await gitlabRequest<GitLabPersonalAccessToken[]>(instanceUrl, `/personal_access_tokens?user_id=${userId}&state=active`, token);
  return raw;
}

export async function revokePersonalAccessToken(instanceUrl: string, token: string, tokenId: number): Promise<void> {
  await gitlabRequest<void>(instanceUrl, `/personal_access_tokens/${tokenId}`, token, "DELETE");
}
