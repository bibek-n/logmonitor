import crypto from "crypto";

// AES-256-GCM, key derived from the NextAuth secret this app already requires - same pattern
// as src/lib/totp.ts and src/lib/sqlServerMonitoring/credentials.ts, own salt string so the
// derived key differs from every other use of NEXTAUTH_SECRET-derived keys in this app.
// Stored as "iv:authTag:ciphertext" (hex). Used for GitHub PATs and OAuth access/refresh
// tokens - GitHub App installation tokens are never stored (minted fresh per sync, see
// githubApp.ts), so they never need this at all.
const ENCRYPTION_ALGO = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET must be set to encrypt/decrypt GitHub connection credentials.");
  return crypto.scryptSync(secret, "codequality-github-secret", 32);
}

export function encryptGitHubToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptGitHubToken(stored: string): string {
  const [ivHex, authTagHex, encryptedHex] = stored.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error("Malformed encrypted GitHub token.");
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
