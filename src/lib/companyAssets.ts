import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

// Company logo/favicon are public marketing assets, same reasoning as src/lib/sliderImages.ts.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "company");
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico"]);
export const MAX_COMPANY_ASSET_BYTES = 4 * 1024 * 1024;

export function validateCompanyAsset(filename: string, size: number): { ok: boolean; error?: string } {
  if (size > MAX_COMPANY_ASSET_BYTES) return { ok: false, error: "Image must be 4 MB or smaller." };
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return { ok: false, error: "Unsupported image type (use PNG/JPEG/WebP/SVG/ICO)." };
  return { ok: true };
}

export async function saveCompanyAsset(buffer: Buffer, originalName: string): Promise<string> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(originalName).toLowerCase();
  const fileName = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);
  return `/uploads/company/${fileName}`;
}

export async function deleteCompanyAsset(assetPath: string): Promise<void> {
  const fileName = path.basename(assetPath);
  await fs.rm(path.join(UPLOAD_DIR, fileName), { force: true });
}
