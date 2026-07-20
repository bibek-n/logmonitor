import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import * as tar from "tar";
import { repoDirName, resolveGitHubCacheDir, resolveConnectionToken } from "./sync";
import { encryptGitHubToken } from "./crypto";

describe("repoDirName", () => {
  it("joins owner and repo with a double underscore", () => {
    expect(repoDirName("octocat", "hello-world")).toBe("octocat__hello-world");
  });

  it("strips path-traversal and separator characters defensively", () => {
    expect(repoDirName("../../etc", "passwd")).toBe(".._.._etc__passwd");
    expect(repoDirName("a/b", "c\\d")).toBe("a_b__c_d");
  });
});

describe("resolveGitHubCacheDir", () => {
  const previous = process.env.CODE_QUALITY_GITHUB_CACHE_DIR;
  afterEach(() => {
    if (previous === undefined) delete process.env.CODE_QUALITY_GITHUB_CACHE_DIR;
    else process.env.CODE_QUALITY_GITHUB_CACHE_DIR = previous;
  });

  it("defaults to a fixed subdirectory under process.cwd() - inside the default allowed scan root", () => {
    delete process.env.CODE_QUALITY_GITHUB_CACHE_DIR;
    expect(resolveGitHubCacheDir()).toBe(path.join(process.cwd(), ".code-quality-github-cache"));
  });

  it("honors an explicit override", () => {
    process.env.CODE_QUALITY_GITHUB_CACHE_DIR = "/custom/cache/dir";
    expect(resolveGitHubCacheDir()).toBe("/custom/cache/dir");
  });
});

describe("resolveConnectionToken", () => {
  const previousSecret = process.env.NEXTAUTH_SECRET;
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
  });
  afterEach(() => {
    if (previousSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = previousSecret;
  });

  it("decrypts the stored token for a PAT connection", async () => {
    const encrypted = encryptGitHubToken("my-pat-token");
    const token = await resolveConnectionToken({ id: 1, authMethod: "PAT", accessTokenEncrypted: encrypted, installationId: null });
    expect(token).toBe("my-pat-token");
  });

  it("decrypts the stored token for an OAuthApp connection", async () => {
    const encrypted = encryptGitHubToken("my-oauth-token");
    const token = await resolveConnectionToken({ id: 1, authMethod: "OAuthApp", accessTokenEncrypted: encrypted, installationId: null });
    expect(token).toBe("my-oauth-token");
  });

  it("throws for a PAT/OAuthApp connection with no stored token", async () => {
    await expect(resolveConnectionToken({ id: 1, authMethod: "PAT", accessTokenEncrypted: null, installationId: null })).rejects.toThrow(/no stored token/);
  });

  it("throws for a GitHubApp connection when GitHub App env vars are not configured", async () => {
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_SLUG;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
    await expect(resolveConnectionToken({ id: 1, authMethod: "GitHubApp", accessTokenEncrypted: null, installationId: 123 })).rejects.toThrow(/no longer configured/);
  });

  it("throws for a GitHubApp connection missing its installation id", async () => {
    await expect(resolveConnectionToken({ id: 1, authMethod: "GitHubApp", accessTokenEncrypted: null, installationId: null })).rejects.toThrow(/missing its installation id/);
  });
});

describe("syncGitHubRepo (full extraction round-trip)", () => {
  const previousSecret = process.env.NEXTAUTH_SECRET;
  const previousCacheDir = process.env.CODE_QUALITY_GITHUB_CACHE_DIR;
  let cacheDir: string;
  let fixtureDir: string;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "cq-gh-cache-"));
    process.env.CODE_QUALITY_GITHUB_CACHE_DIR = cacheDir;
    fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "cq-gh-fixture-"));
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = previousSecret;
    if (previousCacheDir === undefined) delete process.env.CODE_QUALITY_GITHUB_CACHE_DIR;
    else process.env.CODE_QUALITY_GITHUB_CACHE_DIR = previousCacheDir;
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    vi.doUnmock("./client");
    vi.resetModules();
  });

  async function buildFakeGithubTarball(): Promise<Buffer> {
    // Mirrors GitHub's real tarball shape: a single top-level "<owner>-<repo>-<sha>/" wrapper
    // directory that strip:1 is expected to remove.
    const wrapper = path.join(fixtureDir, "octocat-hello-abc1234");
    fs.mkdirSync(path.join(wrapper, "src"), { recursive: true });
    fs.writeFileSync(path.join(wrapper, "README.md"), "hello");
    fs.writeFileSync(path.join(wrapper, "src", "index.ts"), "export const x = 1;\n");

    const tarPath = path.join(fixtureDir, "fixture.tar.gz");
    await tar.create({ file: tarPath, gzip: true, cwd: fixtureDir }, ["octocat-hello-abc1234"]);
    return fs.readFileSync(tarPath);
  }

  it("extracts the tarball into <cacheDir>/<owner>__<repo>, stripping the wrapper folder", async () => {
    const buffer = await buildFakeGithubTarball();
    vi.resetModules();
    vi.doMock("./client", () => ({
      downloadRepoTarball: vi.fn(async () => ({ buffer, commitSha: null })),
      getCommitSha: vi.fn(async () => "abc1234abc1234abc1234abc1234abc1234abcd"),
    }));
    const { syncGitHubRepo: syncWithMock } = await import("./sync");

    const result = await syncWithMock({
      connection: { id: 1, authMethod: "PAT", accessTokenEncrypted: encryptGitHubToken("token"), installationId: null },
      owner: "octocat",
      repo: "hello",
      ref: "main",
    });

    expect(result.localPath).toBe(path.join(cacheDir, "octocat__hello"));
    expect(result.commitSha).toBe("abc1234abc1234abc1234abc1234abc1234abcd");
    expect(fs.readFileSync(path.join(result.localPath, "README.md"), "utf8")).toBe("hello");
    expect(fs.readFileSync(path.join(result.localPath, "src", "index.ts"), "utf8")).toBe("export const x = 1;\n");
    // strip:1 removed the wrapper - it must not appear as a nested directory in the output.
    expect(fs.existsSync(path.join(result.localPath, "octocat-hello-abc1234"))).toBe(false);
  });

  it("wipes any previous contents of the destination on re-sync (clean snapshot, no stale files)", async () => {
    const destDir = path.join(cacheDir, "octocat__hello");
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, "stale-file-from-a-previous-ref.txt"), "old");

    const buffer = await buildFakeGithubTarball();
    vi.resetModules();
    vi.doMock("./client", () => ({
      downloadRepoTarball: vi.fn(async () => ({ buffer, commitSha: null })),
      getCommitSha: vi.fn(async () => "newsha"),
    }));
    const { syncGitHubRepo: syncWithMock } = await import("./sync");

    const result = await syncWithMock({
      connection: { id: 1, authMethod: "PAT", accessTokenEncrypted: encryptGitHubToken("token"), installationId: null },
      owner: "octocat",
      repo: "hello",
      ref: "main",
    });

    expect(fs.existsSync(path.join(result.localPath, "stale-file-from-a-previous-ref.txt"))).toBe(false);
    expect(fs.existsSync(path.join(result.localPath, "README.md"))).toBe(true);
  });

  it("rejects a tarball larger than the configured limit before extracting anything", async () => {
    const buffer = Buffer.alloc(1024, 1);
    vi.resetModules();
    vi.doMock("./client", () => ({
      downloadRepoTarball: vi.fn(async () => ({ buffer, commitSha: null })),
      getCommitSha: vi.fn(async () => "sha"),
    }));
    const { syncGitHubRepo: syncWithMock } = await import("./sync");

    await expect(
      syncWithMock({
        connection: { id: 1, authMethod: "PAT", accessTokenEncrypted: encryptGitHubToken("token"), installationId: null },
        owner: "octocat",
        repo: "hello",
        ref: "main",
        maxTarballMb: 0, // 0MB ceiling - even a 1KB buffer must be rejected
      })
    ).rejects.toThrow(/above the configured limit/);
  });
});
