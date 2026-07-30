import crypto from "crypto";
import argon2 from "argon2";
import { getDb, sql } from "../db";
import { validateUserCredentials } from "../authCore";

const IV_BYTES = 12;
const KEY_BYTES = 32;

// Every other secret-encryption module in this app derives its AES key via
// crypto.scryptSync(NEXTAUTH_SECRET, "<module-salt>", 32) - see mailSecurity/credentials.ts,
// websiteApiMonitoring/apiCredentials.ts, sqlServerMonitoring/credentials.ts,
// repoConnections/{github,gitlab}/crypto.ts. This vault deliberately uses Argon2id instead -
// its contents (SSH private keys, RDP/database passwords) grant real remote code execution on
// real infrastructure, a categorically higher stake than any of those modules' secrets, so a
// slower, memory-hard KDF is worth the one-time cost per process. Every other Remote Access
// convention (nav, permissions, migrations, API shape) still matches the rest of the app.
let cachedKey: Buffer | null = null;

async function getVaultSalt(): Promise<Buffer> {
  const db = await getDb();
  const result = await db.query<{ VaultSaltHex: string }>("SELECT VaultSaltHex FROM RemoteAccessSettings WHERE Id = 1");
  const saltHex = result.recordset[0]?.VaultSaltHex;
  if (!saltHex) throw new Error("Remote Access vault salt not found - run migrate-remote-access.ts first.");
  return Buffer.from(saltHex, "hex");
}

// Derived once per process and cached - Argon2id is deliberately slow/memory-hard, so paying
// that cost on every single encrypt/decrypt call would make routine connection dialing (which
// decrypts a stored credential on every dial) noticeably slow. Matches this app's existing
// acceptance of in-memory, per-process-lifetime state (e.g. Remote Support's rate limiter).
async function getVaultKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey;

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not configured - required to derive the Remote Access vault key.");
  const salt = await getVaultSalt();

  const derived = await argon2.hash(secret, {
    type: argon2.argon2id,
    salt,
    raw: true,
    hashLength: KEY_BYTES,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 1,
  });
  cachedKey = Buffer.from(derived);
  return cachedKey;
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await getVaultKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export async function decryptSecret(stored: string): Promise<string> {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) throw new Error("Malformed encrypted secret.");

  const key = await getVaultKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return plaintext.toString("utf8");
}

// Called by every "reveal" API route (credential reveal, SSH private-key reveal) - re-checks
// the CURRENT user's own password fresh on every single call. Deliberately no timed "unlock
// window": every reveal is freshly authenticated, which is stricter than a lock-after-N-minutes
// design and needs no server-side unlock-state to track or leak. Reuses the same bcrypt path
// authOptions.ts's login flow uses (validateUserCredentials), not a new password-check
// implementation.
export async function verifyPasswordForReveal(username: string, password: string): Promise<boolean> {
  const result = await validateUserCredentials(username, password);
  return result.ok;
}

export function generateFingerprint(publicKey: string): string {
  // SHA256 fingerprint of the base64-decoded key blob (the OpenSSH "SHA256:" format ssh-keygen
  // prints) - publicKey is the full "ssh-ed25519 AAAA... comment" line, only the base64 blob
  // (2nd field) is actually hashed.
  const parts = publicKey.trim().split(/\s+/);
  const blob = parts[1] ?? publicKey.trim();
  const hash = crypto.createHash("sha256").update(Buffer.from(blob, "base64")).digest("base64");
  return `SHA256:${hash.replace(/=+$/, "")}`;
}
