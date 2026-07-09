import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";

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

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface WatermarkOptions {
  hostname: string;
  currentUser: string | null;
  ip: string | null;
  capturedAt: Date;
  capturedBy: "manual" | "interval";
}

export interface ProcessedScreenshot {
  bytes: Buffer;
  format: "png" | "jpeg";
  width: number;
  height: number;
}

// Burns hostname/username/IP/timestamp into the image server-side, before encryption —
// done here rather than agent-side so a modified/compromised agent binary can't strip
// the watermark by simply not adding it. Interval captures are re-encoded as JPEG
// (smaller, and a slight quality loss is an acceptable tradeoff for a periodic capture);
// manual "look right now" captures stay lossless PNG.
export async function watermarkAndCompress(plain: Buffer, opts: WatermarkOptions): Promise<ProcessedScreenshot> {
  const image = sharp(plain);
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const label = `${opts.hostname} · ${opts.currentUser ?? "unknown user"} · ${opts.ip ?? "unknown IP"} · ${opts.capturedAt.toISOString()}`;
  const barHeight = 28;
  const svg = `
    <svg width="${width}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${barHeight}" fill="black" fill-opacity="0.55" />
      <text x="10" y="${barHeight - 9}" font-family="monospace" font-size="14" fill="white">${escapeXml(label)}</text>
    </svg>
  `;

  let pipeline = image.composite([{ input: Buffer.from(svg), top: Math.max(0, height - barHeight), left: 0 }]);

  let format: "png" | "jpeg" = "png";
  if (opts.capturedBy === "interval") {
    pipeline = pipeline.jpeg({ quality: 80 });
    format = "jpeg";
  } else {
    pipeline = pipeline.png();
  }

  const bytes = await pipeline.toBuffer();
  return { bytes, format, width, height };
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
