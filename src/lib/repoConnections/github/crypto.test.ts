import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptGitHubToken, decryptGitHubToken } from "./crypto";

describe("GitHub token encryption", () => {
  const previousSecret = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-github-token-encryption";
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = previousSecret;
  });

  it("round-trips a token through encrypt then decrypt", () => {
    const token = "github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz";
    const encrypted = encryptGitHubToken(token);
    expect(decryptGitHubToken(encrypted)).toBe(token);
  });

  it("produces a different ciphertext each time (random IV) even for the same token", () => {
    const token = "gho_sametoken";
    const a = encryptGitHubToken(token);
    const b = encryptGitHubToken(token);
    expect(a).not.toBe(b);
    expect(decryptGitHubToken(a)).toBe(token);
    expect(decryptGitHubToken(b)).toBe(token);
  });

  it("stores as iv:authTag:ciphertext hex triplet", () => {
    const encrypted = encryptGitHubToken("some-token");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    for (const part of parts) expect(/^[0-9a-f]+$/.test(part)).toBe(true);
  });

  it("throws when NEXTAUTH_SECRET is missing", () => {
    delete process.env.NEXTAUTH_SECRET;
    expect(() => encryptGitHubToken("x")).toThrow(/NEXTAUTH_SECRET/);
  });

  it("throws on malformed stored ciphertext", () => {
    expect(() => decryptGitHubToken("not-a-valid-format")).toThrow(/Malformed/);
  });

  it("throws when decrypting with a different secret (auth tag mismatch)", () => {
    const encrypted = encryptGitHubToken("secret-token");
    process.env.NEXTAUTH_SECRET = "a-different-secret-entirely";
    expect(() => decryptGitHubToken(encrypted)).toThrow();
  });

  it("throws when the ciphertext has been tampered with", () => {
    const encrypted = encryptGitHubToken("secret-token");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tampered = `${iv}:${authTag}:${ciphertext.slice(0, -2)}00`;
    expect(() => decryptGitHubToken(tampered)).toThrow();
  });
});
