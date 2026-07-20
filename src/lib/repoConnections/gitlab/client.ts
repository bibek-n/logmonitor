export class GitLabApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "GitLabApiError";
  }
}

// Every self-hosted instance is a different origin, so - unlike the GitHub client, which has
// exactly one fixed API host - every function here takes instanceUrl explicitly. Normalized
// once (strip a trailing slash) so callers can pass either "https://gitlab.example.com" or
// "https://gitlab.example.com/".
function apiBase(instanceUrl: string): string {
  return `${instanceUrl.replace(/\/+$/, "")}/api/v4`;
}

// GitLab authenticates PAT/project-access-token requests via this header (not
// "Authorization: Bearer", which is reserved for OAuth Application tokens - out of scope here
// since this connection method is PAT-only).
function authHeaders(token: string): HeadersInit {
  return { "PRIVATE-TOKEN": token };
}

async function gitlabJson<T>(instanceUrl: string, path: string, token: string): Promise<T> {
  const res = await fetch(`${apiBase(instanceUrl)}${path}`, { headers: authHeaders(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GitLabApiError(`GitLab API ${path} returned ${res.status}: ${body.slice(0, 300)}`, res.status);
  }
  return res.json() as Promise<T>;
}

export interface GitLabUser {
  id: number;
  username: string;
}

export async function verifyTokenAndGetUser(instanceUrl: string, token: string): Promise<GitLabUser> {
  return gitlabJson<GitLabUser>(instanceUrl, "/user", token);
}

export interface GitLabProjectSummary {
  id: number;
  pathWithNamespace: string;
  name: string;
  visibility: string;
  defaultBranch: string | null;
}

interface RawProject {
  id: number;
  path_with_namespace: string;
  name: string;
  visibility: string;
  default_branch: string | null;
}

function toProjectSummary(p: RawProject): GitLabProjectSummary {
  return { id: p.id, pathWithNamespace: p.path_with_namespace, name: p.name, visibility: p.visibility, defaultBranch: p.default_branch };
}

// membership=true scopes the list to projects the token's user actually belongs to (own +
// group + invited), matching the GitHub client's /user/repos affiliation filter. `search` is a
// real GitLab API query param here (unlike the GitHub client's client-side filter) since
// GitLab's /projects endpoint supports it natively without a separate rate-limited endpoint.
export async function listProjectsForToken(instanceUrl: string, token: string, opts: { page?: number; perPage?: number; search?: string } = {}): Promise<{ projects: GitLabProjectSummary[]; hasMore: boolean }> {
  const page = opts.page ?? 1;
  const perPage = Math.min(100, opts.perPage ?? 30);
  const searchParam = opts.search?.trim() ? `&search=${encodeURIComponent(opts.search.trim())}` : "";
  const raw = await gitlabJson<RawProject[]>(instanceUrl, `/projects?membership=true&order_by=last_activity_at&per_page=${perPage}&page=${page}${searchParam}`, token);
  return { projects: raw.map(toProjectSummary), hasMore: raw.length === perPage };
}

export async function getProject(instanceUrl: string, token: string, projectIdOrPath: string | number): Promise<GitLabProjectSummary> {
  const encoded = typeof projectIdOrPath === "number" ? projectIdOrPath : encodeURIComponent(projectIdOrPath);
  const raw = await gitlabJson<RawProject>(instanceUrl, `/projects/${encoded}`, token);
  return toProjectSummary(raw);
}

export async function getCommitSha(instanceUrl: string, token: string, projectId: number, ref: string): Promise<string> {
  const raw = await gitlabJson<{ id: string }>(instanceUrl, `/projects/${projectId}/repository/commits/${encodeURIComponent(ref)}`, token);
  return raw.id;
}

// Unlike GitHub's tarball endpoint, GitLab streams the archive directly from the same host
// with the same auth header the whole way through - no redirect-to-a-different-host dance to
// handle here.
export async function downloadProjectArchive(instanceUrl: string, token: string, projectId: number, ref: string): Promise<Buffer> {
  const res = await fetch(`${apiBase(instanceUrl)}/projects/${projectId}/repository/archive.tar.gz?sha=${encodeURIComponent(ref)}`, { headers: authHeaders(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GitLabApiError(`Failed to download archive for project ${projectId}@${ref}: ${res.status} ${body.slice(0, 300)}`, res.status);
  }
  return Buffer.from(await res.arrayBuffer());
}
