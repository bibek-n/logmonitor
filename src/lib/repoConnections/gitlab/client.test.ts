import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyTokenAndGetUser, listProjectsForToken, downloadProjectArchive, getCommitSha, GitLabApiError } from "./client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("verifyTokenAndGetUser", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the authenticated user and sends PRIVATE-TOKEN (not Authorization)", async () => {
    const calls: Headers[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        calls.push(new Headers(init?.headers));
        return jsonResponse({ id: 7, username: "octocat" });
      })
    );
    const user = await verifyTokenAndGetUser("https://gitlab.example.com", "glpat-token");
    expect(user).toEqual({ id: 7, username: "octocat" });
    expect(calls[0].get("private-token")).toBe("glpat-token");
    expect(calls[0].has("authorization")).toBe(false);
  });

  it("throws GitLabApiError with the response status on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unauthorized", { status: 401 })));
    await expect(verifyTokenAndGetUser("https://gitlab.example.com", "bad")).rejects.toBeInstanceOf(GitLabApiError);
    await expect(verifyTokenAndGetUser("https://gitlab.example.com", "bad")).rejects.toMatchObject({ status: 401 });
  });

  it("normalizes a trailing slash on the instance URL", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return jsonResponse({ id: 1, username: "x" });
      })
    );
    await verifyTokenAndGetUser("https://gitlab.example.com/", "token");
    expect(urls[0]).toBe("https://gitlab.example.com/api/v4/user");
  });
});

describe("listProjectsForToken", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps raw GitLab project objects to the summary shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([{ id: 5, path_with_namespace: "group/sub/project", name: "project", visibility: "private", default_branch: "main" }]))
    );
    const { projects, hasMore } = await listProjectsForToken("https://gitlab.example.com", "token");
    expect(projects).toEqual([{ id: 5, pathWithNamespace: "group/sub/project", name: "project", visibility: "private", defaultBranch: "main" }]);
    expect(hasMore).toBe(false);
  });

  it("passes search as a native GitLab query param, not a client-side filter", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return jsonResponse([]);
      })
    );
    await listProjectsForToken("https://gitlab.example.com", "token", { search: "hello world" });
    expect(urls[0]).toContain("search=hello%20world");
  });
});

describe("getCommitSha", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the commit id field", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ id: "abc123def456" })));
    const sha = await getCommitSha("https://gitlab.example.com", "token", 5, "main");
    expect(sha).toBe("abc123def456");
  });
});

describe("downloadProjectArchive", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("downloads directly with PRIVATE-TOKEN, no redirect handling needed", async () => {
    const fakeBuffer = Buffer.from("fake-archive-bytes");
    const calls: { url: string; headers: Headers }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), headers: new Headers(init?.headers) });
        return new Response(fakeBuffer, { status: 200 });
      })
    );
    const buffer = await downloadProjectArchive("https://gitlab.example.com", "token", 5, "main");
    expect(buffer.equals(fakeBuffer)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/projects/5/repository/archive.tar.gz?sha=main");
    expect(calls[0].headers.get("private-token")).toBe("token");
  });

  it("throws GitLabApiError on a failed download", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    await expect(downloadProjectArchive("https://gitlab.example.com", "token", 5, "main")).rejects.toMatchObject({ status: 404 });
  });
});
