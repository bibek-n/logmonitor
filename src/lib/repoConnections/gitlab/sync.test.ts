import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import * as tar from "tar";
import { repoDirName, resolveGitLabCacheDir, resolveConnectionToken } from "./sync";
import { encryptGitLabToken } from "./crypto";

describe("repoDirName", () => {
  it("flattens the host and a subgroup path into one sanitized segment", () => {
    expect(repoDirName("https://gitlab.example.com", "group/subgroup/project")).toBe("gitlab.example.com__group_subgroup_project");
  });

  it("strips path separators defensively, so a malicious path can't escape the cache dir", () => {
    const result = repoDirName("https://gitlab.example.com:8443", "../../etc/passwd");
    expect(result).not.toContain("/");
    expect(result).not.toContain("\\");
    expect(result.startsWith("gitlab.example.com_8443__")).toBe(true);
  });
});

describe("resolveGitLabCacheDir", () => {
  const previous = process.env.CODE_QUALITY_GITLAB_CACHE_DIR;
  afterEach(() => {
    if (previous === undefined) delete process.env.CODE_QUALITY_GITLAB_CACHE_DIR;
    else process.env.CODE_QUALITY_GITLAB_CACHE_DIR = previous;
  });

  it("defaults to a fixed subdirectory under process.cwd()", () => {
    delete process.env.CODE_QUALITY_GITLAB_CACHE_DIR;
    expect(resolveGitLabCacheDir()).toBe(path.join(process.cwd(), ".code-quality-gitlab-cache"));
  });

  it("honors an explicit override", () => {
    process.env.CODE_QUALITY_GITLAB_CACHE_DIR = "/custom/gitlab/cache";
    expect(resolveGitLabCacheDir()).toBe("/custom/gitlab/cache");
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

  it("decrypts the stored token", async () => {
    const encrypted = encryptGitLabToken("my-gitlab-token");
    const token = await resolveConnectionToken({ id: 1, instanceUrl: "https://gitlab.example.com", accessTokenEncrypted: encrypted });
    expect(token).toBe("my-gitlab-token");
  });
});

describe("syncGitLabRepo (full extraction round-trip)", () => {
  const previousSecret = process.env.NEXTAUTH_SECRET;
  const previousCacheDir = process.env.CODE_QUALITY_GITLAB_CACHE_DIR;
  let cacheDir: string;
  let fixtureDir: string;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "cq-gl-cache-"));
    process.env.CODE_QUALITY_GITLAB_CACHE_DIR = cacheDir;
    fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "cq-gl-fixture-"));
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = previousSecret;
    if (previousCacheDir === undefined) delete process.env.CODE_QUALITY_GITLAB_CACHE_DIR;
    else process.env.CODE_QUALITY_GITLAB_CACHE_DIR = previousCacheDir;
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    vi.doUnmock("./client");
    vi.resetModules();
  });

  async function buildFakeGitlabArchive(): Promise<Buffer> {
    // GitLab's archive also wraps everything in one top-level "<group>-<project>-<sha>/" folder.
    const wrapper = path.join(fixtureDir, "group-project-abc1234");
    fs.mkdirSync(path.join(wrapper, "lib"), { recursive: true });
    fs.writeFileSync(path.join(wrapper, "README.md"), "hello from gitlab");
    fs.writeFileSync(path.join(wrapper, "lib", "main.py"), "x = 1\n");

    const tarPath = path.join(fixtureDir, "fixture.tar.gz");
    await tar.create({ file: tarPath, gzip: true, cwd: fixtureDir }, ["group-project-abc1234"]);
    return fs.readFileSync(tarPath);
  }

  it("extracts the archive into <cacheDir>/<host>__<path>, stripping the wrapper folder", async () => {
    const buffer = await buildFakeGitlabArchive();
    vi.resetModules();
    vi.doMock("./client", () => ({
      downloadProjectArchive: vi.fn(async () => buffer),
      getCommitSha: vi.fn(async () => "abc1234abc1234abc1234abc1234abc1234abcd"),
    }));
    const { syncGitLabRepo: syncWithMock } = await import("./sync");

    const result = await syncWithMock({
      connection: { id: 1, instanceUrl: "https://gitlab.example.com", accessTokenEncrypted: encryptGitLabToken("token") },
      projectId: 42,
      projectPath: "group/project",
      ref: "main",
    });

    expect(result.localPath).toBe(path.join(cacheDir, "gitlab.example.com__group_project"));
    expect(result.commitSha).toBe("abc1234abc1234abc1234abc1234abc1234abcd");
    expect(fs.readFileSync(path.join(result.localPath, "README.md"), "utf8")).toBe("hello from gitlab");
    expect(fs.readFileSync(path.join(result.localPath, "lib", "main.py"), "utf8")).toBe("x = 1\n");
    expect(fs.existsSync(path.join(result.localPath, "group-project-abc1234"))).toBe(false);
  });

  it("wipes any previous contents of the destination on re-sync", async () => {
    const destDir = path.join(cacheDir, "gitlab.example.com__group_project");
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, "stale.txt"), "old");

    const buffer = await buildFakeGitlabArchive();
    vi.resetModules();
    vi.doMock("./client", () => ({
      downloadProjectArchive: vi.fn(async () => buffer),
      getCommitSha: vi.fn(async () => "newsha"),
    }));
    const { syncGitLabRepo: syncWithMock } = await import("./sync");

    const result = await syncWithMock({
      connection: { id: 1, instanceUrl: "https://gitlab.example.com", accessTokenEncrypted: encryptGitLabToken("token") },
      projectId: 42,
      projectPath: "group/project",
      ref: "main",
    });

    expect(fs.existsSync(path.join(result.localPath, "stale.txt"))).toBe(false);
    expect(fs.existsSync(path.join(result.localPath, "README.md"))).toBe(true);
  });

  it("rejects an archive larger than the configured limit", async () => {
    const buffer = Buffer.alloc(1024, 1);
    vi.resetModules();
    vi.doMock("./client", () => ({
      downloadProjectArchive: vi.fn(async () => buffer),
      getCommitSha: vi.fn(async () => "sha"),
    }));
    const { syncGitLabRepo: syncWithMock } = await import("./sync");

    await expect(
      syncWithMock({
        connection: { id: 1, instanceUrl: "https://gitlab.example.com", accessTokenEncrypted: encryptGitLabToken("token") },
        projectId: 42,
        projectPath: "group/project",
        ref: "main",
        maxTarballMb: 0,
      })
    ).rejects.toThrow(/above the configured limit/);
  });
});
