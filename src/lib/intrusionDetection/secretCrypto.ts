import crypto from "crypto";

// AES-256-GCM, key derived from the NextAuth secret this app already requires - same pattern
// as src/lib/mailSecurity/credentials.ts (this app's majority convention for secret-at-rest
// encryption), own salt string so the derived key differs from every other module's use of
// NEXTAUTH_SECRET-derived keys. Stored as "iv:authTag:ciphertext" (hex). Used to encrypt
// SecurityNotificationChannels.EncryptedConfig (Slack/Teams/webhook URLs and signing secrets).
const ENCRYPTION_ALGO = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET must be set to encrypt/decrypt intrusion detection notification channel secrets.");
  return crypto.scryptSync(secret, "ids-notification-secret", 32);
}

export function encryptIdsSecret(value: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptIdsSecret(stored: string): string {
  const [ivHex, authTagHex, encryptedHex] = stored.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error("Malformed encrypted intrusion detection notification channel secret.");
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
