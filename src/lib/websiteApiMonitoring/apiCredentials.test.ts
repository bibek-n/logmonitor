import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptApiAuthConfig, decryptApiAuthConfig, maskApiAuthConfig, mergeApiAuthConfigSecrets, SECRET_MASK_PLACEHOLDER } from "./apiCredentials";
import { ApiAuthConfig } from "./types";

describe("API monitor auth config encryption", () => {
  const previousSecret = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-api-monitor-credential-encryption";
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = previousSecret;
  });

  it("round-trips a BearerToken config through encrypt then decrypt", () => {
    const config: ApiAuthConfig = { type: "BearerToken", token: "sk-real-secret-value" };
    const encrypted = encryptApiAuthConfig(config);
    expect(decryptApiAuthConfig(encrypted)).toEqual(config);
  });

  it("round-trips an OAuth2ClientCredentials config", () => {
    const config: ApiAuthConfig = { type: "OAuth2ClientCredentials", tokenUrl: "https://auth.example.com/token", clientId: "id123", clientSecret: "shh", scope: "read write" };
    const encrypted = encryptApiAuthConfig(config);
    expect(decryptApiAuthConfig(encrypted)).toEqual(config);
  });

  it("returns None for a null stored value", () => {
    expect(decryptApiAuthConfig(null)).toEqual({ type: "None" });
  });

  it("returns None for malformed stored ciphertext rather than throwing", () => {
    expect(decryptApiAuthConfig("not-a-valid-format")).toEqual({ type: "None" });
  });
});

describe("maskApiAuthConfig", () => {
  it("passes through None unchanged", () => {
    expect(maskApiAuthConfig({ type: "None" })).toEqual({ type: "None" });
  });

  it("masks a non-empty ApiKey value, leaves metadata untouched", () => {
    const masked = maskApiAuthConfig({ type: "ApiKey", keyLocation: "header", keyName: "X-API-Key", keyValue: "real-value" });
    expect(masked).toEqual({ type: "ApiKey", keyLocation: "header", keyName: "X-API-Key", keyValue: SECRET_MASK_PLACEHOLDER });
  });

  it("leaves an empty secret as an empty string rather than masking it", () => {
    const masked = maskApiAuthConfig({ type: "BearerToken", token: "" });
    expect(masked).toEqual({ type: "BearerToken", token: "" });
  });

  it("masks BasicAuth's password but not the username", () => {
    const masked = maskApiAuthConfig({ type: "BasicAuth", username: "svc-account", password: "hunter2" });
    expect(masked).toEqual({ type: "BasicAuth", username: "svc-account", password: SECRET_MASK_PLACEHOLDER });
  });
});

describe("mergeApiAuthConfigSecrets", () => {
  it("keeps the existing secret when the incoming value is the mask placeholder", () => {
    const existing: ApiAuthConfig = { type: "BearerToken", token: "real-token" };
    const incoming: ApiAuthConfig = { type: "BearerToken", token: SECRET_MASK_PLACEHOLDER };
    expect(mergeApiAuthConfigSecrets(incoming, existing)).toEqual(existing);
  });

  it("keeps the existing secret when the incoming value is blank", () => {
    const existing: ApiAuthConfig = { type: "ApiKey", keyLocation: "header", keyName: "X-API-Key", keyValue: "real-key" };
    const incoming: ApiAuthConfig = { type: "ApiKey", keyLocation: "query", keyName: "X-API-Key", keyValue: "" };
    const merged = mergeApiAuthConfigSecrets(incoming, existing);
    expect(merged).toEqual({ type: "ApiKey", keyLocation: "query", keyName: "X-API-Key", keyValue: "real-key" });
  });

  it("uses the incoming secret when it's a genuinely new value", () => {
    const existing: ApiAuthConfig = { type: "BasicAuth", username: "old", password: "old-pass" };
    const incoming: ApiAuthConfig = { type: "BasicAuth", username: "new", password: "new-pass" };
    expect(mergeApiAuthConfigSecrets(incoming, existing)).toEqual(incoming);
  });

  it("doesn't try to merge across a changed auth type", () => {
    const existing: ApiAuthConfig = { type: "BearerToken", token: "old-token" };
    const incoming: ApiAuthConfig = { type: "None" };
    expect(mergeApiAuthConfigSecrets(incoming, existing)).toEqual({ type: "None" });
  });
});
