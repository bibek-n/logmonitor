import crypto from "crypto";

// AES-256-GCM, key derived from the NextAuth secret this app already requires - same pattern as
// src/lib/sqlServerMonitoring/credentials.ts and src/lib/repoConnections/gitlab/crypto.ts, own
// salt string so the derived key differs from every other use of NEXTAUTH_SECRET-derived keys.
// Stored as "iv:authTag:ciphertext" (hex). GitLab admin token + Glesys API key are comparable in
// sensitivity to those other modules' API credentials, not the "real remote code execution on
// infrastructure" tier of the Remote Access Credentials Vault (see that module's crypto.ts for
// why it uses a slower Argon2id key instead) - this lighter, synchronous scrypt derivation is
// the right fit here.
const ENCRYPTION_ALGO = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET must be set to encrypt/decrypt Offboarding module credentials.");
  return crypto.scryptSync(secret, "offboarding-secret", 32);
}

export function encryptOffboardingSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptOffboardingSecret(stored: string): string {
  const [ivHex, authTagHex, encryptedHex] = stored.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error("Malformed encrypted Offboarding credential.");
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
