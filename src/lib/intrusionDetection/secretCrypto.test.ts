import { describe, expect, it, beforeAll } from "vitest";
import { encryptIdsSecret, decryptIdsSecret } from "./secretCrypto";

describe("secretCrypto", () => {
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-ids-notification-channels";
  });

  it("round-trips a plaintext value through encrypt/decrypt", () => {
    const plaintext = "https://hooks.slack.com/services/T000/B000/xxxxxxxxxxxxxxxxxxxx";
    const encrypted = encryptIdsSecret(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptIdsSecret(encrypted)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV) for the same plaintext", () => {
    const a = encryptIdsSecret("same-value");
    const b = encryptIdsSecret("same-value");
    expect(a).not.toBe(b);
  });

  it("stores as iv:authTag:ciphertext hex triples", () => {
    const encrypted = encryptIdsSecret("value");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    for (const part of parts) expect(part).toMatch(/^[0-9a-f]+$/);
  });

  it("throws on a malformed stored value", () => {
    expect(() => decryptIdsSecret("not-a-valid-format")).toThrow();
  });

  it("throws on a tampered auth tag", () => {
    const encrypted = encryptIdsSecret("value");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tampered = `${iv}:${authTag.replace(/.$/, authTag.at(-1) === "0" ? "1" : "0")}:${ciphertext}`;
    expect(() => decryptIdsSecret(tampered)).toThrow();
  });
});
