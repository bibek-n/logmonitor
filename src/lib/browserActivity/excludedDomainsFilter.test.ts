import { describe, it, expect } from "vitest";
import { isDomainExcluded } from "./excludedDomainsFilter";

describe("isDomainExcluded", () => {
  it("matches an exact domain", () => {
    expect(isDomainExcluded("example-bank.com", ["example-bank.com"])).toBe(true);
  });

  it("matches a true subdomain via suffix matching", () => {
    expect(isDomainExcluded("mail.example-bank.com", ["example-bank.com"])).toBe(true);
  });

  it("does NOT match a domain that merely contains the excluded string as a substring", () => {
    // The classic false-positive trap: "example-bank.com.evil.com" contains "example-bank.com"
    // as a substring but is not a subdomain of it - boundary-aware matching must reject this.
    expect(isDomainExcluded("example-bank.com.evil.com", ["example-bank.com"])).toBe(false);
  });

  it("does NOT match an unrelated domain", () => {
    expect(isDomainExcluded("example.com", ["example-bank.com"])).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isDomainExcluded("MAIL.Example-Bank.COM", ["example-bank.com"])).toBe(true);
  });

  it("skips blank entries in the excluded list", () => {
    expect(isDomainExcluded("example.com", ["", "  ", "bank.com"])).toBe(false);
  });

  it("returns false against an empty excluded list", () => {
    expect(isDomainExcluded("example.com", [])).toBe(false);
  });
});
