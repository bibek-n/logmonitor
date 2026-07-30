import { describe, it, expect } from "vitest";
import { matchCategoryRule } from "./classifyDomain";
import type { DomainCategoryRule } from "./types";

function rule(overrides: Partial<DomainCategoryRule>): DomainCategoryRule {
  return { id: 1, domain: "example.com", categoryId: 1, matchType: "suffix", source: "manual", ...overrides };
}

describe("matchCategoryRule", () => {
  it("returns null when no rule matches", () => {
    expect(matchCategoryRule("unrelated.com", [rule({ domain: "example.com" })])).toBeNull();
  });

  it("matches an exact-type rule only against the exact same domain", () => {
    const rules = [rule({ id: 1, domain: "example.com", matchType: "exact", categoryId: 10 })];
    expect(matchCategoryRule("example.com", rules)?.categoryId).toBe(10);
    expect(matchCategoryRule("mail.example.com", rules)).toBeNull();
  });

  it("matches a suffix-type rule against a subdomain", () => {
    const rules = [rule({ id: 1, domain: "example.com", matchType: "suffix", categoryId: 20 })];
    expect(matchCategoryRule("mail.example.com", rules)?.categoryId).toBe(20);
  });

  it("does not let a suffix rule match via mere substring containment", () => {
    const rules = [rule({ id: 1, domain: "example.com", matchType: "suffix", categoryId: 20 })];
    expect(matchCategoryRule("example.com.evil.com", rules)).toBeNull();
  });

  it("prefers an exact match over a suffix match for the same domain string", () => {
    const rules = [
      rule({ id: 1, domain: "example.com", matchType: "suffix", categoryId: 20 }),
      rule({ id: 2, domain: "example.com", matchType: "exact", categoryId: 30 }),
    ];
    expect(matchCategoryRule("example.com", rules)?.categoryId).toBe(30);
  });

  it("prefers the longest (most specific) suffix match among several candidates", () => {
    const rules = [
      rule({ id: 1, domain: "example.com", matchType: "suffix", categoryId: 1 }),
      rule({ id: 2, domain: "mail.example.com", matchType: "suffix", categoryId: 2 }),
    ];
    expect(matchCategoryRule("inbox.mail.example.com", rules)?.categoryId).toBe(2);
  });

  it("normalizes case and whitespace before comparing", () => {
    const rules = [rule({ id: 1, domain: "Example.com", matchType: "exact", categoryId: 5 })];
    expect(matchCategoryRule("  EXAMPLE.COM  ", rules)?.categoryId).toBe(5);
  });
});
