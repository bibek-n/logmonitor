import crypto from "crypto";
import path from "path";
import fs from "fs/promises";

// Stored outside any web-servable directory — only reachable through the authenticated,
// audited /api/admin/screenshots/[id]/file route.
const STORAGE_ROOT = path.join(process.cwd(), "agent-storage", "screenshots");

function getEncryptionKey(): Buffer {
  const raw = process.env.SCREENSHOT_ENC_KEY;
  if (!raw) throw new Error("SCREENSHOT_ENC_KEY is not configured");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("SCREENSHOT_ENC_KEY must decode to exactly 32 bytes");
  return key;
}

// Layout: [12-byte IV][16-byte GCM auth tag][ciphertext]. The agent uploads plaintext image
// bytes over HTTPS (transport encryption is TLS's job); the server encrypts at rest here so
// a filesystem-level compromise doesn't expose screenshots directly.
export function encryptScreenshot(plain: Buffer): Buffer {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

export function decryptScreenshot(encryptedWithHeader: Buffer): Buffer {
  const key = getEncryptionKey();
  const iv = encryptedWithHeader.subarray(0, 12);
  const authTag = encryptedWithHeader.subarray(12, 28);
  const ciphertext = encryptedWithHeader.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function deviceStorageDir(deviceId: string): string {
  return path.join(STORAGE_ROOT, deviceId);
}

export async function saveScreenshotFile(deviceId: string, encryptedBytes: Buffer): Promise<string> {
  const dir = deviceStorageDir(deviceId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${crypto.randomUUID()}.enc`);
  await fs.writeFile(filePath, encryptedBytes);
  return filePath;
}

export async function readScreenshotFile(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

export async function deleteScreenshotFile(filePath: string): Promise<void> {
  await fs.rm(filePath, { force: true });
}
