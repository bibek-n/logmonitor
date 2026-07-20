import fs from "fs";
import os from "os";
import path from "path";
import * as tar from "tar";
import { downloadRepoTarball, getCommitSha } from "./client";
import { mintInstallationToken, getGitHubAppConfig } from "./githubApp";
import { decryptGitHubToken } from "./crypto";

export type GitHubAuthMethod = "PAT" | "OAuthApp" | "GitHubApp";

export interface GitHubConnectionRow {
  id: number;
  authMethod: GitHubAuthMethod;
  accessTokenEncrypted: string | null;
  installationId: number | null;
}

const DEFAULT_MAX_TARBALL_MB = 500;

// PAT and OAuthApp connections store their (encrypted) token directly. A GitHubApp connection
// never stores a long-lived token at all - a fresh installation token is minted on every sync
// (expires in ~1 hour, scoped to only the repos the installation was granted), which is the
// more secure of the three methods precisely because there's no long-lived secret sitting in
// the database for it.
export async function resolveConnectionToken(connection: GitHubConnectionRow): Promise<string> {
  if (connection.authMethod === "GitHubApp") {
    if (!connection.installationId) throw new Error("GitHub App connection is missing its installation id.");
    const config = getGitHubAppConfig();
    if (!config) throw new Error("GitHub App is no longer configured on this server (GITHUB_APP_ID/GITHUB_APP_PRIVATE_KEY missing).");
    const { token } = await mintInstallationToken(config, connection.installationId);
    return token;
  }
  if (!connection.accessTokenEncrypted) throw new Error(`GitHub connection ${connection.id} has no stored token.`);
  return decryptGitHubToken(connection.accessTokenEncrypted);
}

export function resolveGitHubCacheDir(): string {
  return process.env.CODE_QUALITY_GITHUB_CACHE_DIR?.trim() || path.join(process.cwd(), ".code-quality-github-cache");
}

export function repoDirName(owner: string, repo: string): string {
  // Sanitized to a safe, predictable directory name - owner/repo are validated against
  // GitHub's own naming rules before this is ever called (see githubRepoIdentifierSchema in
  // the connection route's zod schema), but this strips anything unexpected defensively regardless.
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${safe(owner)}__${safe(repo)}`;
}

export interface SyncResult {
  localPath: string;
  commitSha: string;
}

export interface SyncOptions {
  connection: GitHubConnectionRow;
  owner: string;
  repo: string;
  ref: string;
  maxTarballMb?: number;
}

// Downloads a point-in-time snapshot of the repo at `ref` (not a git clone - no history, no
// .git directory, which is all a static analyzer needs and avoids depending on a `git` binary
// being installed/on-PATH for the IIS app-pool identity). The destination directory is wiped
// and recreated on every sync so re-scanning never mixes files from two different refs.
export async function syncGitHubRepo(opts: SyncOptions): Promise<SyncResult> {
  const token = await resolveConnectionToken(opts.connection);
  const maxBytes = (opts.maxTarballMb ?? DEFAULT_MAX_TARBALL_MB) * 1024 * 1024;

  const [{ buffer }, commitSha] = await Promise.all([
    downloadRepoTarball(token, opts.owner, opts.repo, opts.ref),
    getCommitSha(token, opts.owner, opts.repo, opts.ref),
  ]);

  if (buffer.length > maxBytes) {
    throw new Error(`Repository tarball for ${opts.owner}/${opts.repo}@${opts.ref} is ${Math.round(buffer.length / 1024 / 1024)}MB, above the configured limit of ${opts.maxTarballMb ?? DEFAULT_MAX_TARBALL_MB}MB.`);
  }

  const cacheDir = resolveGitHubCacheDir();
  fs.mkdirSync(cacheDir, { recursive: true });
  const destDir = path.join(cacheDir, repoDirName(opts.owner, opts.repo));

  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  // tar.extract() needs a real file on disk to read from - buffered in a scratch temp file
  // (not the destination) and removed in a finally block regardless of outcome.
  const tempFile = path.join(os.tmpdir(), `cq-gh-${process.pid}-${Date.now()}.tar.gz`);
  try {
    fs.writeFileSync(tempFile, buffer);
    // strip: 1 drops GitHub's single top-level "<owner>-<repo>-<sha>/" wrapper folder so repo
    // files land directly in destDir. tar's own zip-slip protection (entries containing ".."
    // are rejected) is active by default and not overridden here.
    await tar.extract({ file: tempFile, cwd: destDir, strip: 1, gzip: true, preservePaths: false });
  } finally {
    fs.rmSync(tempFile, { force: true });
  }

  return { localPath: destDir, commitSha };
}
