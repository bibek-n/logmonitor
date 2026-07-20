import { syncGitHubRepo, resolveConnectionToken as resolveGitHubToken } from "./github/sync";
import { syncGitLabRepo, resolveConnectionToken as resolveGitLabToken } from "./gitlab/sync";
import type { RepoConnectionRow } from "./types";

export interface SyncOptions {
  connection: RepoConnectionRow;
  // GitHub: literal owner/repo. GitLab: owner holds the numeric project id (as a string) and
  // repo holds path_with_namespace - the same repurposing every module's Project row already
  // uses for its own RepositoryOwner/RepositoryName columns (see e.g. Code Quality's
  // runScan.ts), kept consistent here so callers never branch on provider themselves.
  owner: string;
  repo: string;
  ref: string;
  maxTarballMb?: number;
}

export interface SyncResult {
  localPath: string;
  commitSha: string;
}

// The one function every module's runScan.ts calls for a repo-backed project, regardless of
// provider - this is the entire point of the shared repoConnections module: a new module never
// needs to know GitHub and GitLab have different APIs, auth headers, or archive formats.
export async function syncRepo(opts: SyncOptions): Promise<SyncResult> {
  if (opts.connection.provider === "GitHub") {
    return syncGitHubRepo({
      connection: { id: opts.connection.id, authMethod: opts.connection.authMethod, accessTokenEncrypted: opts.connection.accessTokenEncrypted, installationId: opts.connection.installationId },
      owner: opts.owner,
      repo: opts.repo,
      ref: opts.ref,
      maxTarballMb: opts.maxTarballMb,
    });
  }

  if (!opts.connection.instanceUrl) throw new Error(`GitLab connection ${opts.connection.id} is missing its InstanceUrl.`);
  if (!opts.connection.accessTokenEncrypted) throw new Error(`GitLab connection ${opts.connection.id} has no stored token.`);
  const projectId = Number(opts.owner);
  if (!Number.isInteger(projectId) || projectId <= 0) throw new Error(`Invalid GitLab project id "${opts.owner}".`);

  return syncGitLabRepo({
    connection: { id: opts.connection.id, instanceUrl: opts.connection.instanceUrl, accessTokenEncrypted: opts.connection.accessTokenEncrypted },
    projectId,
    projectPath: opts.repo,
    ref: opts.ref,
    maxTarballMb: opts.maxTarballMb,
  });
}

export async function resolveConnectionToken(connection: RepoConnectionRow): Promise<string> {
  if (connection.provider === "GitHub") {
    return resolveGitHubToken({ id: connection.id, authMethod: connection.authMethod, accessTokenEncrypted: connection.accessTokenEncrypted, installationId: connection.installationId });
  }
  if (!connection.instanceUrl) throw new Error(`GitLab connection ${connection.id} is missing its InstanceUrl.`);
  if (!connection.accessTokenEncrypted) throw new Error(`GitLab connection ${connection.id} has no stored token.`);
  return resolveGitLabToken({ id: connection.id, instanceUrl: connection.instanceUrl, accessTokenEncrypted: connection.accessTokenEncrypted });
}
