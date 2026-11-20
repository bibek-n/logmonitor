import { describe, it, expect } from "vitest";
import { extractDomainExpiryDate, extractRegistrableDomain } from "./domainExpiry";

describe("extractDomainExpiryDate", () => {
  it("parses the registry-style field (Verisign/ICANN gTLD responses)", () => {
    const text = "Domain Name: EXAMPLE.COM\nRegistry Expiry Date: 2027-08-14T04:00:00Z\n";
    expect(extractDomainExpiryDate(text)?.toISOString()).toBe("2027-08-14T04:00:00.000Z");
  });

  it("parses the registrar-style field (GoDaddy/Namecheap-style responses)", () => {
    const text = "Registrar Registration Expiration Date: 2026-01-01T00:00:00Z\n";
    expect(extractDomainExpiryDate(text)?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("parses a ccTLD's paid-till field", () => {
    const text = "paid-till:     2028-03-01T00:00:00Z\n";
    expect(extractDomainExpiryDate(text)?.toISOString()).toBe("2028-03-01T00:00:00.000Z");
  });

  it("returns null when no recognizable expiry field is present", () => {
    expect(extractDomainExpiryDate("Domain Name: EXAMPLE.COM\nStatus: active\n")).toBeNull();
  });

  it("returns null rather than an Invalid Date when the field's value can't be parsed", () => {
    expect(extractDomainExpiryDate("Expiry Date: not-a-real-date\n")).toBeNull();
  });
});

describe("extractRegistrableDomain", () => {
  it("returns the last two labels for an ordinary gTLD", () => {
    expect(extractRegistrableDomain("https://www.example.com/path")).toBe("example.com");
  });

  it("strips a port and query string along with the path", () => {
    expect(extractRegistrableDomain("https://sub.example.com:8443/a?b=c")).toBe("example.com");
  });

  it("keeps three labels for a known multi-label suffix (co.uk)", () => {
    expect(extractRegistrableDomain("https://www.bbc.co.uk")).toBe("bbc.co.uk");
  });

  it("keeps three labels for a known multi-label suffix (com.np)", () => {
    expect(extractRegistrableDomain("https://daraz.com.np")).toBe("daraz.com.np");
  });

  it("returns null for an unparseable URL", () => {
    expect(extractRegistrableDomain("not a url")).toBeNull();
  });
});
