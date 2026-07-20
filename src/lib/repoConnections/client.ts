import * as github from "./github/client";
import * as gitlab from "./gitlab/client";
import { resolveConnectionToken } from "./sync";
import type { RepoConnectionRow } from "./types";

// Provider-agnostic repo summary - the shape every module's repo picker UI renders, regardless
// of which provider's client actually produced it.
export interface RepoSummary {
  id: string; // GitHub: numeric id as string. GitLab: numeric project id as string.
  owner: string; // GitHub: literal owner login. GitLab: numeric project id (see repoConnections/sync.ts's SyncOptions comment on why).
  name: string; // GitHub: repo name. GitLab: path_with_namespace.
  fullName: string; // Always the human-readable "owner/name"-shaped label for display.
  private: boolean;
  defaultBranch: string | null;
}

export async function listReposForConnection(connection: RepoConnectionRow, opts: { page?: number; search?: string } = {}): Promise<{ repos: RepoSummary[]; hasMore: boolean }> {
  const token = await resolveConnectionToken(connection);

  if (connection.provider === "GitHub") {
    const { repos, hasMore } =
      connection.authMethod === "GitHubApp" ? await github.listReposForInstallation(token, opts) : await github.listReposForToken(token, opts);
    return {
      repos: repos.map((r) => ({ id: String(r.id), owner: r.owner, name: r.name, fullName: r.fullName, private: r.private, defaultBranch: r.defaultBranch })),
      hasMore,
    };
  }

  if (!connection.instanceUrl) throw new Error(`GitLab connection ${connection.id} is missing its InstanceUrl.`);
  const { projects, hasMore } = await gitlab.listProjectsForToken(connection.instanceUrl, token, opts);
  return {
    repos: projects.map((p) => ({ id: String(p.id), owner: String(p.id), name: p.pathWithNamespace, fullName: p.pathWithNamespace, private: p.visibility !== "public", defaultBranch: p.defaultBranch })),
    hasMore,
  };
}

export interface VerifiedTokenOwner {
  ownerLogin: string;
}

// Used when creating a new PAT/OAuth connection, to confirm the token actually works before
// storing it and to resolve the display OwnerLogin - never returns or logs the token itself.
export async function verifyConnectionToken(provider: "GitHub" | "GitLab", token: string, instanceUrl?: string): Promise<VerifiedTokenOwner> {
  if (provider === "GitHub") {
    const user = await github.verifyTokenAndGetUser(token);
    return { ownerLogin: user.login };
  }
  if (!instanceUrl) throw new Error("instanceUrl is required to verify a GitLab token.");
  const user = await gitlab.verifyTokenAndGetUser(instanceUrl, token);
  return { ownerLogin: user.username };
}

export { GitHubApiError } from "./github/client";
export { GitLabApiError } from "./gitlab/client";
