import fs from "fs";
import os from "os";
import path from "path";
import * as tar from "tar";
import { downloadProjectArchive, getCommitSha } from "./client";
import { decryptGitLabToken } from "./crypto";

export interface GitLabConnectionRow {
  id: number;
  instanceUrl: string;
  accessTokenEncrypted: string;
}

const DEFAULT_MAX_TARBALL_MB = 500;

export async function resolveConnectionToken(connection: GitLabConnectionRow): Promise<string> {
  return decryptGitLabToken(connection.accessTokenEncrypted);
}

export function resolveGitLabCacheDir(): string {
  return process.env.CODE_QUALITY_GITLAB_CACHE_DIR?.trim() || path.join(process.cwd(), ".code-quality-gitlab-cache");
}

// GitLab project paths can include subgroups ("group/subgroup/project"), unlike GitHub's flat
// owner/repo - the whole path is flattened into one sanitized segment rather than nested
// directories, same reasoning as github/sync.ts's repoDirName.
export function repoDirName(instanceUrl: string, projectPath: string): string {
  const host = instanceUrl.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9.-]/g, "_");
  const safePath = projectPath.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${host}__${safePath}`;
}

export interface GitLabSyncResult {
  localPath: string;
  commitSha: string;
}

export interface GitLabSyncOptions {
  connection: GitLabConnectionRow;
  projectId: number;
  projectPath: string;
  ref: string;
  maxTarballMb?: number;
}

// Same point-in-time-snapshot approach as github/sync.ts's syncGitHubRepo - no git clone, no
// history, destination wiped and recreated on every sync.
export async function syncGitLabRepo(opts: GitLabSyncOptions): Promise<GitLabSyncResult> {
  const token = await resolveConnectionToken(opts.connection);
  const maxBytes = (opts.maxTarballMb ?? DEFAULT_MAX_TARBALL_MB) * 1024 * 1024;

  const [buffer, commitSha] = await Promise.all([
    downloadProjectArchive(opts.connection.instanceUrl, token, opts.projectId, opts.ref),
    getCommitSha(opts.connection.instanceUrl, token, opts.projectId, opts.ref),
  ]);

  if (buffer.length > maxBytes) {
    throw new Error(`Repository archive for ${opts.projectPath}@${opts.ref} is ${Math.round(buffer.length / 1024 / 1024)}MB, above the configured limit of ${opts.maxTarballMb ?? DEFAULT_MAX_TARBALL_MB}MB.`);
  }

  const cacheDir = resolveGitLabCacheDir();
  fs.mkdirSync(cacheDir, { recursive: true });
  const destDir = path.join(cacheDir, repoDirName(opts.connection.instanceUrl, opts.projectPath));

  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  const tempFile = path.join(os.tmpdir(), `cq-gl-${process.pid}-${Date.now()}.tar.gz`);
  try {
    fs.writeFileSync(tempFile, buffer);
    await tar.extract({ file: tempFile, cwd: destDir, strip: 1, gzip: true, preservePaths: false });
  } finally {
    fs.rmSync(tempFile, { force: true });
  }

  return { localPath: destDir, commitSha };
}
