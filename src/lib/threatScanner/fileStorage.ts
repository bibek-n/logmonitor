import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

// Same convention as src/lib/qaAttachments.ts: outside the web root, UUID filename on disk
// (original name kept in the ThreatScans row), only ever reachable via an authenticated
// download route that streams the bytes - never served directly from public/. Files here can
// be anything an admin wants scanned (not just images/docs like qa-attachments), so this is
// deliberately its own storage root rather than reusing qa-attachments/.
const STORAGE_ROOT = path.join(process.cwd(), "threat-scanner-uploads");

// VirusTotal's public API caps direct (non-"large file") uploads at 32MB.
export const MAX_SCAN_FILE_BYTES = 32 * 1024 * 1024;

export function validateScanFile(filename: string, size: number): { ok: boolean; error?: string } {
  if (size <= 0) return { ok: false, error: "File is empty." };
  if (size > MAX_SCAN_FILE_BYTES) return { ok: false, error: "File must be 32 MB or smaller (VirusTotal's direct-upload limit)." };
  return { ok: true };
}

export async function saveScanFile(buffer: Buffer, originalName: string): Promise<string> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const ext = path.extname(originalName).toLowerCase();
  const filePath = path.join(STORAGE_ROOT, `${crypto.randomUUID()}${ext}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function readScanFile(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}
