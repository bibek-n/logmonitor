import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

const testSaltHex = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

vi.mock("../db", () => ({
  getDb: vi.fn(async () => ({
    query: vi.fn(async () => ({ recordset: [{ VaultSaltHex: testSaltHex }] })),
  })),
  sql: { NVarChar: "NVarChar", Int: "Int", VarChar: "VarChar" },
}));

vi.mock("../authCore", () => ({ validateUserCredentials: vi.fn() }));

import { validateUserCredentials } from "../authCore";
import { encryptSecret, decryptSecret, verifyPasswordForReveal, generateFingerprint } from "./crypto";

describe("Remote Access vault crypto", () => {
  const previousSecret = process.env.NEXTAUTH_SECRET;

  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-remote-access-vault";
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = previousSecret;
  });

  it("round-trips a plaintext secret through encrypt then decrypt", async () => {
    const plaintext = "super-secret-root-password";
    const encrypted = await encryptSecret(plaintext);
    expect(await decryptSecret(encrypted)).toBe(plaintext);
  });

  it("round-trips a multi-line SSH private key", async () => {
    const key = "-----BEGIN OPENSSH PRIVATE KEY-----\nAAAAB3NzaC1yc2EAAAADAQABAAAB\n-----END OPENSSH PRIVATE KEY-----";
    const encrypted = await encryptSecret(key);
    expect(await decryptSecret(encrypted)).toBe(key);
  });

  it("produces a different ciphertext each time (random IV) for the same plaintext", async () => {
    const a = await encryptSecret("same-value");
    const b = await encryptSecret("same-value");
    expect(a).not.toBe(b);
    expect(await decryptSecret(a)).toBe("same-value");
    expect(await decryptSecret(b)).toBe("same-value");
  });

  it("throws on malformed ciphertext instead of silently returning garbage", async () => {
    await expect(decryptSecret("not-a-valid-format")).rejects.toThrow();
  });

  it("throws when the auth tag has been tampered with", async () => {
    const encrypted = await encryptSecret("tamper-test");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const flippedTag = (parseInt(authTag.slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, "0") + authTag.slice(2);
    await expect(decryptSecret(`${iv}:${flippedTag}:${ciphertext}`)).rejects.toThrow();
  });
});

describe("verifyPasswordForReveal", () => {
  it("returns true when authCore reports a valid credential", async () => {
    vi.mocked(validateUserCredentials).mockResolvedValueOnce({ ok: true } as never);
    expect(await verifyPasswordForReveal("alice", "correct-password")).toBe(true);
  });

  it("returns false when authCore rejects the credential", async () => {
    vi.mocked(validateUserCredentials).mockResolvedValueOnce({ ok: false, reason: "Incorrect password" } as never);
    expect(await verifyPasswordForReveal("alice", "wrong-password")).toBe(false);
  });
});

describe("generateFingerprint", () => {
  it("produces a stable SHA256: fingerprint for the same public key", () => {
    const publicKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBartestbartestbartestbartest comment";
    expect(generateFingerprint(publicKey)).toBe(generateFingerprint(publicKey));
    expect(generateFingerprint(publicKey)).toMatch(/^SHA256:/);
  });

  it("produces different fingerprints for different keys", () => {
    const a = generateFingerprint("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBartestbartestbartestbartest a");
    const b = generateFingerprint("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBdiffdiffdiffdiffdiffdiffdiff b");
    expect(a).not.toBe(b);
  });
});
