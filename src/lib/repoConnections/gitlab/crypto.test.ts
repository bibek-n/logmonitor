import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptGitLabToken, decryptGitLabToken } from "./crypto";

describe("GitLab token encryption", () => {
  const previousSecret = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-gitlab-token-encryption";
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = previousSecret;
  });

  it("round-trips a token through encrypt then decrypt", () => {
    const token = "glpat-ABCDEFGHIJKLMNOPQRST";
    const encrypted = encryptGitLabToken(token);
    expect(decryptGitLabToken(encrypted)).toBe(token);
  });

  it("produces a different ciphertext each time (random IV) even for the same token", () => {
    const token = "glpat-sametoken";
    const a = encryptGitLabToken(token);
    const b = encryptGitLabToken(token);
    expect(a).not.toBe(b);
    expect(decryptGitLabToken(a)).toBe(token);
    expect(decryptGitLabToken(b)).toBe(token);
  });

  it("stores as iv:authTag:ciphertext hex triplet", () => {
    const encrypted = encryptGitLabToken("some-token");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    for (const part of parts) expect(/^[0-9a-f]+$/.test(part)).toBe(true);
  });

  it("throws when NEXTAUTH_SECRET is missing", () => {
    delete process.env.NEXTAUTH_SECRET;
    expect(() => encryptGitLabToken("x")).toThrow(/NEXTAUTH_SECRET/);
  });

  it("throws on malformed stored ciphertext", () => {
    expect(() => decryptGitLabToken("not-a-valid-format")).toThrow(/Malformed/);
  });

  it("uses a different derived key than the GitHub crypto module (own salt)", async () => {
    const { encryptGitHubToken } = await import("../github/crypto");
    const encrypted = encryptGitHubToken("cross-module-token");
    // Decrypting a GitHub-encrypted value with the GitLab module must fail (different key).
    expect(() => decryptGitLabToken(encrypted)).toThrow();
  });
});
