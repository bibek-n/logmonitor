import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_URL_RULES } from "./types";

vi.mock("dns/promises", () => {
  const lookup = vi.fn();
  return { default: { lookup }, lookup };
});

describe("inspectUrl", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("detects a known cloud-storage provider by domain", async () => {
    const { inspectUrl } = await import("./urlInspection");
    const result = await inspectUrl("https://drive.google.com/file/d/abc123/view", DEFAULT_URL_RULES);
    expect(result.cloudProvider).toBe("Google Drive");
    expect(result.domain).toBe("drive.google.com");
  });

  it("flags a punycode/lookalike domain that isn't allowlisted", async () => {
    const { inspectUrl } = await import("./urlInspection");
    const result = await inspectUrl("https://xn--pypal-4ve.com/login", DEFAULT_URL_RULES);
    expect(result.isLookalikeDomain).toBe(true);
  });

  it("does not flag a punycode domain that is explicitly allowlisted", async () => {
    const { inspectUrl } = await import("./urlInspection");
    const result = await inspectUrl("https://xn--pypal-4ve.com/login", { ...DEFAULT_URL_RULES, allowlist: ["xn--pypal-4ve.com"] });
    expect(result.isLookalikeDomain).toBe(false);
  });

  it("reports a malformed URL without throwing", async () => {
    const { inspectUrl } = await import("./urlInspection");
    const result = await inspectUrl("not a url at all", DEFAULT_URL_RULES);
    expect(result.blockedReason).toMatch(/malformed/i);
  });

  it("blocks resolving a shortened link when the redirect target is a private/internal address (SSRF guard)", async () => {
    const dns = await import("dns/promises");
    vi.mocked(dns.lookup).mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as never);

    const { inspectUrl } = await import("./urlInspection");
    const result = await inspectUrl("https://bit.ly/malicious", DEFAULT_URL_RULES);
    expect(result.ssrfBlocked).toBe(true);
  });

  it("follows a redirect to a public address and reports the resolved URL", async () => {
    const dns = await import("dns/promises");
    vi.mocked(dns.lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 301, headers: new Headers({ location: "https://example.com/final" }) })
    );

    const { inspectUrl } = await import("./urlInspection");
    const result = await inspectUrl("https://bit.ly/somelink", DEFAULT_URL_RULES);
    expect(result.isShortenedLink).toBe(true);
    expect(result.ssrfBlocked).toBe(false);
  });
});
