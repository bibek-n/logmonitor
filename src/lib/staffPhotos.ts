import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

// Employee profile photos — same reasoning/pattern as src/lib/companyAssets.ts, just a
// separate upload directory and a tighter (headshot-appropriate) file type allowlist.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "staff");
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
export const MAX_STAFF_PHOTO_BYTES = 4 * 1024 * 1024;

export function validateStaffPhoto(filename: string, size: number): { ok: boolean; error?: string } {
  if (size > MAX_STAFF_PHOTO_BYTES) return { ok: false, error: "Photo must be 4 MB or smaller." };
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return { ok: false, error: "Unsupported image type (use PNG/JPEG/WebP)." };
  return { ok: true };
}

export async function saveStaffPhoto(buffer: Buffer, originalName: string): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(originalName).toLowerCase();
  const fileName = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);
  return `/uploads/staff/${fileName}`;
}

export async function deleteStaffPhoto(photoPath: string): Promise<void> {
  const fileName = path.basename(photoPath);
  await fs.rm(path.join(UPLOAD_DIR, fileName), { force: true });
}
