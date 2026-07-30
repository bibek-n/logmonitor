import crypto from "crypto";
import { ApiAuthConfig } from "./types";

// AES-256-GCM, key derived from the NextAuth secret this app already requires - same pattern
// as totp.ts/mailSecurity/credentials.ts/repoConnections' crypto.ts, each with its own salt so
// a key derived for one module's secrets can't be reused to decrypt another's. Stored as
// "iv:authTag:ciphertext" (hex).
const ENCRYPTION_ALGO = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET must be set to encrypt/decrypt API monitor credentials.");
  return crypto.scryptSync(secret, "apimon-secret", 32);
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(stored: string): string {
  const [ivHex, authTagHex, encryptedHex] = stored.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error("Malformed encrypted API monitor credential.");
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

// The entire ApiAuthConfig object (including its secret field) is JSON-stringified and
// encrypted as one blob, rather than encrypting individual fields - simpler, and every field
// besides the one secret is non-sensitive metadata (header name, key location, token URL,
// username, scope) that's cheap to re-encrypt alongside it.
export function encryptApiAuthConfig(config: ApiAuthConfig): string {
  return encrypt(JSON.stringify(config));
}

export function decryptApiAuthConfig(stored: string | null): ApiAuthConfig {
  if (!stored) return { type: "None" };
  try {
    return JSON.parse(decrypt(stored)) as ApiAuthConfig;
  } catch {
    return { type: "None" };
  }
}

// Sent to the browser in place of any real secret - a fixed, recognizable placeholder (not the
// real value, not an empty string that could be confused with "no secret set") so the frontend
// can both display "a secret is configured" and detect an unmodified field on save.
export const SECRET_MASK_PLACEHOLDER = "••••••••";

// Never send a decrypted secret back to the browser - this is what the GET/list routes return
// instead of the real ApiAuthConfig. Non-secret fields (keyName/keyLocation/tokenUrl/username/
// scope) pass through unmasked since they're needed to render the edit form.
export function maskApiAuthConfig(config: ApiAuthConfig): ApiAuthConfig {
  switch (config.type) {
    case "None":
      return config;
    case "ApiKey":
      return { ...config, keyValue: config.keyValue ? SECRET_MASK_PLACEHOLDER : "" };
    case "BearerToken":
      return { ...config, token: config.token ? SECRET_MASK_PLACEHOLDER : "" };
    case "BasicAuth":
      return { ...config, password: config.password ? SECRET_MASK_PLACEHOLDER : "" };
    case "OAuth2ClientCredentials":
      return { ...config, clientSecret: config.clientSecret ? SECRET_MASK_PLACEHOLDER : "" };
  }
}

// Reconciles an incoming (validated) auth config from a save request against the existing
// stored one: any secret field left blank or still holding the mask placeholder (i.e. the user
// never touched it) keeps the existing real value instead of being overwritten with a blank -
// the same problem `alertEmail`/other partial-update fields solve with `!== undefined` checks,
// just one level deeper since the secret itself is never round-tripped to the client at all.
export function mergeApiAuthConfigSecrets(incoming: ApiAuthConfig, existing: ApiAuthConfig): ApiAuthConfig {
  if (incoming.type !== existing.type) return incoming;
  switch (incoming.type) {
    case "None":
      return incoming;
    case "ApiKey":
      return { ...incoming, keyValue: isUnchangedSecret(incoming.keyValue) ? (existing as typeof incoming).keyValue : incoming.keyValue };
    case "BearerToken":
      return { ...incoming, token: isUnchangedSecret(incoming.token) ? (existing as typeof incoming).token : incoming.token };
    case "BasicAuth":
      return { ...incoming, password: isUnchangedSecret(incoming.password) ? (existing as typeof incoming).password : incoming.password };
    case "OAuth2ClientCredentials":
      return { ...incoming, clientSecret: isUnchangedSecret(incoming.clientSecret) ? (existing as typeof incoming).clientSecret : incoming.clientSecret };
  }
}

function isUnchangedSecret(value: string): boolean {
  return !value || value === SECRET_MASK_PLACEHOLDER;
}
