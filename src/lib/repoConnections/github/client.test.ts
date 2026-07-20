import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadRepoTarball, verifyTokenAndGetUser, listReposForToken, GitHubApiError } from "./client";

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers: { "content-type": "application/json", ...init.headers } });
}

describe("verifyTokenAndGetUser", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the authenticated user on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ login: "octocat", id: 1 })));
    const user = await verifyTokenAndGetUser("some-token");
    expect(user).toEqual({ login: "octocat", id: 1 });
  });

  it("throws GitHubApiError with the response status on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad credentials", { status: 401 })));
    await expect(verifyTokenAndGetUser("bad-token")).rejects.toMatchObject({ status: 401 });
    await expect(verifyTokenAndGetUser("bad-token")).rejects.toBeInstanceOf(GitHubApiError);
  });
});

describe("listReposForToken", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps raw GitHub repo objects to the summary shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse([
          { id: 1, full_name: "octocat/hello", name: "hello", owner: { login: "octocat" }, private: false, default_branch: "main", updated_at: "2024-01-01T00:00:00Z" },
        ])
      )
    );
    const { repos, hasMore } = await listReposForToken("token");
    expect(repos).toEqual([{ id: 1, fullName: "octocat/hello", owner: "octocat", name: "hello", private: false, defaultBranch: "main", updatedAt: "2024-01-01T00:00:00Z" }]);
    expect(hasMore).toBe(false);
  });

  it("filters client-side by the search term against fullName", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse([
          { id: 1, full_name: "octocat/hello-world", name: "hello-world", owner: { login: "octocat" }, private: false, default_branch: "main", updated_at: "" },
          { id: 2, full_name: "octocat/other-repo", name: "other-repo", owner: { login: "octocat" }, private: false, default_branch: "main", updated_at: "" },
        ])
      )
    );
    const { repos } = await listReposForToken("token", { search: "hello" });
    expect(repos).toHaveLength(1);
    expect(repos[0].fullName).toBe("octocat/hello-world");
  });
});

describe("downloadRepoTarball", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("follows the api.github.com -> codeload.github.com redirect without forwarding the Authorization header", async () => {
    const calls: { url: string; headers: Headers }[] = [];
    const fakeBuffer = Buffer.from("fake-tarball-bytes");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), headers: new Headers(init?.headers) });
        if (String(url).includes("api.github.com")) {
          return new Response(null, { status: 302, headers: { location: "https://codeload.github.com/octocat/hello/tar.gz/refs/heads/main" } });
        }
        return new Response(fakeBuffer, { status: 200, headers: { "content-disposition": "attachment; filename=octocat-hello-abc1234.tar.gz" } });
      })
    );

    const result = await downloadRepoTarball("secret-token", "octocat", "hello", "main");

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("api.github.com");
    expect(calls[0].headers.get("authorization")).toBe("Bearer secret-token");
    expect(calls[1].url).toContain("codeload.github.com");
    expect(calls[1].headers.get("authorization")).toBeNull(); // never forwarded to the pre-signed codeload URL
    expect(result.buffer.equals(fakeBuffer)).toBe(true);
    expect(result.commitSha).toBe("abc1234");
  });

  it("throws a GitHubApiError when the redirect has no Location header", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 302 })));
    await expect(downloadRepoTarball("token", "o", "r", "main")).rejects.toBeInstanceOf(GitHubApiError);
  });

  it("throws when the initial request fails outright (not a redirect, not ok)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    await expect(downloadRepoTarball("token", "o", "r", "main")).rejects.toMatchObject({ status: 404 });
  });

  it("throws when the redirect target itself fails to download", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("api.github.com")) return new Response(null, { status: 302, headers: { location: "https://codeload.github.com/x" } });
        return new Response("gone", { status: 410 });
      })
    );
    await expect(downloadRepoTarball("token", "o", "r", "main")).rejects.toMatchObject({ status: 410 });
  });
});
