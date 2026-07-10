import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

// Slider images are intentionally public marketing assets, stored under public/uploads/
// so Next.js serves them directly — unlike ticket attachments or endpoint-agent
// screenshots, which are deliberately kept off any web-servable path.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "slider");
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
export const MAX_SLIDER_IMAGE_BYTES = 8 * 1024 * 1024;

export function validateSliderImage(filename: string, size: number): { ok: boolean; error?: string } {
  if (size > MAX_SLIDER_IMAGE_BYTES) return { ok: false, error: "Image must be 8 MB or smaller." };
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return { ok: false, error: "Unsupported image type (use PNG/JPEG/WebP)." };
  return { ok: true };
}

export async function saveSliderImage(buffer: Buffer, originalName: string): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(originalName).toLowerCase();
  const fileName = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);
  return `/uploads/slider/${fileName}`;
}

export async function deleteSliderImage(imagePath: string): Promise<void> {
  const fileName = path.basename(imagePath);
  await fs.rm(path.join(UPLOAD_DIR, fileName), { force: true });
}
