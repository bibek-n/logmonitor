const GITHUB_API_BASE = "https://api.github.com";
const USER_AGENT = "LogMonitor-CodeQuality";
const API_VERSION = "2022-11-28";

export class GitHubApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "GitHubApiError";
  }
}

function commonHeaders(token: string, accept = "application/vnd.github+json"): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    "User-Agent": USER_AGENT,
    "X-GitHub-Api-Version": API_VERSION,
  };
}

async function githubJson<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GITHUB_API_BASE}${path}`, { ...init, headers: { ...commonHeaders(token), ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GitHubApiError(`GitHub API ${path} returned ${res.status}: ${body.slice(0, 300)}`, res.status);
  }
  return res.json() as Promise<T>;
}

export interface GitHubUser {
  login: string;
  id: number;
}

// Used both to validate a freshly-pasted PAT before storing it, and to resolve the OwnerLogin
// shown in the connections list (never the token itself - that's the whole point of storing it
// encrypted and never returning it to the frontend, see requireIntegrationPermission's
// integrations_git_manage gate on every route that touches a connection).
export async function verifyTokenAndGetUser(token: string): Promise<GitHubUser> {
  return githubJson<GitHubUser>("/user", token);
}

export interface GitHubRepoSummary {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
}

interface RawRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
  updated_at: string;
}

function toRepoSummary(r: RawRepo): GitHubRepoSummary {
  return { id: r.id, fullName: r.full_name, owner: r.owner.login, name: r.name, private: r.private, defaultBranch: r.default_branch, updatedAt: r.updated_at };
}

// Lists repos the token can see, newest-activity first. For a GitHub App installation token
// this is scoped to only the repos the installation was granted (GitHub enforces that
// server-side - no extra filtering needed here). `search` is applied client-side against the
// already-fetched page rather than GitHub's separate /search/repositories endpoint, which has
// a much lower rate limit and different auth semantics for installation tokens.
export async function listReposForToken(token: string, opts: { page?: number; perPage?: number; search?: string } = {}): Promise<{ repos: GitHubRepoSummary[]; hasMore: boolean }> {
  const page = opts.page ?? 1;
  const perPage = Math.min(100, opts.perPage ?? 30);
  const raw = await githubJson<RawRepo[]>(`/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`, token);
  let repos = raw.map(toRepoSummary);
  if (opts.search?.trim()) {
    const needle = opts.search.trim().toLowerCase();
    repos = repos.filter((r) => r.fullName.toLowerCase().includes(needle));
  }
  return { repos, hasMore: raw.length === perPage };
}

// A GitHub App installation token can only list the repos it was actually installed on, via a
// different endpoint than a user token - GitHub returns 404 for /user/repos with an
// installation token, and 404 for /installation/repositories with a user token. Callers pick
// the right function based on the connection's AuthMethod (see connections/[id]/repos/route.ts).
export async function listReposForInstallation(installationToken: string, opts: { page?: number; perPage?: number; search?: string } = {}): Promise<{ repos: GitHubRepoSummary[]; hasMore: boolean }> {
  const page = opts.page ?? 1;
  const perPage = Math.min(100, opts.perPage ?? 30);
  const raw = await githubJson<{ repositories: RawRepo[] }>(`/installation/repositories?per_page=${perPage}&page=${page}`, installationToken);
  let repos = raw.repositories.map(toRepoSummary);
  if (opts.search?.trim()) {
    const needle = opts.search.trim().toLowerCase();
    repos = repos.filter((r) => r.fullName.toLowerCase().includes(needle));
  }
  return { repos, hasMore: raw.repositories.length === perPage };
}

export async function getRepo(token: string, owner: string, repo: string): Promise<GitHubRepoSummary> {
  const raw = await githubJson<RawRepo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token);
  return toRepoSummary(raw);
}

export interface TarballDownload {
  buffer: Buffer;
  commitSha: string | null;
}

// GitHub's tarball endpoint 302s to a pre-signed codeload.github.com URL that itself carries
// short-lived auth in the query string - the Authorization header must NOT be forwarded to
// that second request (codeload rejects a foreign Authorization header on some paths, and it
// isn't needed since the URL is already signed). Node's fetch strips Authorization on
// cross-origin redirects by default, but we follow it manually anyway so this behavior is
// explicit and doesn't silently depend on undici's default redirect policy.
export async function downloadRepoTarball(token: string, owner: string, repo: string, ref: string): Promise<TarballDownload> {
  const initial = await fetch(`${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tarball/${encodeURIComponent(ref)}`, {
    headers: commonHeaders(token),
    redirect: "manual",
  });

  if (initial.status !== 302 && initial.status !== 301) {
    if (initial.ok) {
      // Some proxies/environments may already resolve the redirect - accept a direct 200 too.
      const buffer = Buffer.from(await initial.arrayBuffer());
      return { buffer, commitSha: extractCommitShaFromContentDisposition(initial.headers.get("content-disposition")) };
    }
    const body = await initial.text().catch(() => "");
    throw new GitHubApiError(`Failed to start tarball download for ${owner}/${repo}@${ref}: ${initial.status} ${body.slice(0, 300)}`, initial.status);
  }

  const location = initial.headers.get("location");
  if (!location) throw new GitHubApiError(`Tarball redirect for ${owner}/${repo}@${ref} had no Location header.`, 502);

  const download = await fetch(location);
  if (!download.ok) {
    throw new GitHubApiError(`Failed to download tarball for ${owner}/${repo}@${ref} from redirect target: ${download.status}`, download.status);
  }
  const buffer = Buffer.from(await download.arrayBuffer());
  return { buffer, commitSha: extractCommitShaFromContentDisposition(download.headers.get("content-disposition")) };
}

// GitHub names the tarball attachment "<owner>-<repo>-<short-sha>.tar.gz" - a best-effort
// extraction, not authoritative (the real commit sha for LastSyncedCommitSha comes from
// GET /repos/{owner}/{repo}/commits/{ref} in sync.ts instead). Kept as a fallback only.
function extractCommitShaFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/-([0-9a-f]{7,40})\.tar\.gz/i);
  return match ? match[1] : null;
}

export async function getCommitSha(token: string, owner: string, repo: string, ref: string): Promise<string> {
  const raw = await githubJson<{ sha: string }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(ref)}`, token);
  return raw.sha;
}
