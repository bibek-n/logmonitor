import { describe, expect, it } from "vitest";
import { extractReferralServer, isValidIp, isValidIpOrDomain } from "./ipTools";

describe("extractReferralServer", () => {
  it("finds a 'Registrar WHOIS Server' line (typical thin gTLD registry response)", () => {
    const text = ["Domain Name: EXAMPLE.COM", "Registrar WHOIS Server: whois.example-registrar.com", "Registrar: Example Registrar LLC"].join("\n");
    expect(extractReferralServer(text)).toBe("whois.example-registrar.com");
  });

  it("strips a whois:// scheme prefix and trailing slash", () => {
    const text = "ReferralServer: whois://rwhois.example.net/";
    expect(extractReferralServer(text)).toBe("rwhois.example.net");
  });

  it("returns null when there is no referral line (e.g. a thick registry response like .se)", () => {
    const text = ["state:            active", "domain:           websearchpro.se", "registrar:        Loopia AB"].join("\n");
    expect(extractReferralServer(text)).toBeNull();
  });

  it("is case-insensitive on the field label", () => {
    expect(extractReferralServer("whois server: whois.nic.example")).toBe("whois.nic.example");
  });
});

describe("isValidIp", () => {
  it("accepts a plain IPv4 address", () => {
    expect(isValidIp("8.8.8.8")).toBe(true);
  });

  it("rejects an out-of-range IPv4 octet", () => {
    expect(isValidIp("999.1.1.1")).toBe(false);
  });

  it("accepts an IPv6 address", () => {
    expect(isValidIp("2001:4860:4860::8888")).toBe(true);
  });

  it("rejects a domain name", () => {
    expect(isValidIp("example.com")).toBe(false);
  });
});

describe("isValidIpOrDomain", () => {
  it("accepts a plain domain", () => {
    expect(isValidIpOrDomain("websearchpro.se")).toBe(true);
  });

  it("accepts a multi-label ccTLD domain", () => {
    expect(isValidIpOrDomain("example.co.uk")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidIpOrDomain("")).toBe(false);
  });

  it("rejects a string with disallowed characters", () => {
    expect(isValidIpOrDomain("exa mple.com; rm -rf")).toBe(false);
  });
});
