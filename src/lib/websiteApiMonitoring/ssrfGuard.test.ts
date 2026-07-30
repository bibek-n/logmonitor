import { describe, it, expect } from "vitest";
import { isRestrictedIp, checkLiteralIpNotRestricted, createSafeLookup, SsrfBlockedError } from "./ssrfGuard";

describe("isRestrictedIp", () => {
  it("blocks private, loopback, link-local, and cloud metadata ranges", () => {
    expect(isRestrictedIp("10.0.0.5")).toBe(true);
    expect(isRestrictedIp("127.0.0.1")).toBe(true);
    expect(isRestrictedIp("169.254.169.254")).toBe(true);
    expect(isRestrictedIp("172.16.0.1")).toBe(true);
    expect(isRestrictedIp("172.31.255.255")).toBe(true);
    expect(isRestrictedIp("192.168.1.1")).toBe(true);
    expect(isRestrictedIp("::1")).toBe(true);
    expect(isRestrictedIp("fe80::1")).toBe(true);
  });

  it("does not block ordinary public IPv4 addresses", () => {
    expect(isRestrictedIp("8.8.8.8")).toBe(false);
    expect(isRestrictedIp("93.184.216.34")).toBe(false);
  });

  it("does not false-positive on public ranges that merely start similarly to a private range", () => {
    // 172.15.x and 172.32.x are public - only 172.16-172.31 is the private RFC1918 block.
    expect(isRestrictedIp("172.15.0.1")).toBe(false);
    expect(isRestrictedIp("172.32.0.1")).toBe(false);
  });
});

describe("checkLiteralIpNotRestricted", () => {
  it("throws SsrfBlockedError for a literal private IP", () => {
    expect(() => checkLiteralIpNotRestricted("127.0.0.1")).toThrow(SsrfBlockedError);
    expect(() => checkLiteralIpNotRestricted("169.254.169.254")).toThrow(SsrfBlockedError);
  });

  it("does not throw for a literal public IP", () => {
    expect(() => checkLiteralIpNotRestricted("8.8.8.8")).not.toThrow();
  });

  it("does not throw for a non-IP hostname (net.isIP is false, nothing to check here)", () => {
    expect(() => checkLiteralIpNotRestricted("example.com")).not.toThrow();
  });
});

describe("createSafeLookup", () => {
  it("rejects a literal loopback address with SsrfBlockedError instead of resolving it", async () => {
    const lookup = createSafeLookup();
    const err = await new Promise<Error | null>((resolve) => {
      lookup("127.0.0.1", { family: 0 } as never, (e) => resolve(e));
    });
    expect(err).toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects the cloud metadata address", async () => {
    const lookup = createSafeLookup();
    const err = await new Promise<Error | null>((resolve) => {
      lookup("169.254.169.254", { family: 0 } as never, (e) => resolve(e));
    });
    expect(err).toBeInstanceOf(SsrfBlockedError);
  });

  it("resolves a literal public IP through without blocking", async () => {
    const lookup = createSafeLookup();
    const address = await new Promise<string>((resolve, reject) => {
      lookup("8.8.8.8", { family: 0 } as never, (e, addr) => (e ? reject(e) : resolve(addr)));
    });
    expect(address).toBe("8.8.8.8");
  });
});
