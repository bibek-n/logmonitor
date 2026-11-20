import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

// Same storage convention as src/lib/knowledgeBaseDocuments.ts (which itself follows
// complianceEvidence.ts / qaAttachments.ts / ticketAttachments.ts): outside the web root, UUID
// filename on disk (original name kept in the OpsIncidentAttachments row), only ever reachable
// via an authenticated GET route that streams the bytes - never a public path.
const STORAGE_ROOT = path.join(process.cwd(), "ops-incident-attachments");

const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".log", ".png", ".jpg", ".jpeg", ".zip"]);
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export function validateIncidentAttachment(filename: string, size: number): { ok: boolean; error?: string } {
  if (size > MAX_ATTACHMENT_BYTES) return { ok: false, error: "File must be 25 MB or smaller." };
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return { ok: false, error: "Unsupported file type. Allowed: PDF, Word, Excel, PowerPoint, text/CSV/log, image, zip." };
  return { ok: true };
}

export async function saveIncidentAttachment(buffer: Buffer, originalName: string): Promise<string> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const ext = path.extname(originalName).toLowerCase();
  const filePath = path.join(STORAGE_ROOT, `${crypto.randomUUID()}${ext}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function readIncidentAttachment(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

export async function deleteIncidentAttachment(filePath: string): Promise<void> {
  await fs.unlink(filePath).catch(() => {
    // Already gone (or never existed) - deleting the DB row should still succeed either way.
  });
}

const INLINE_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".txt", ".csv", ".log"]);

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".log": "text/plain",
};

export function resolveAttachmentServing(originalFileName: string, storedContentType: string | null, forceDownload: boolean): { contentType: string; disposition: "inline" | "attachment" } {
  const ext = path.extname(originalFileName).toLowerCase();
  const contentType = storedContentType || EXTENSION_CONTENT_TYPES[ext] || "application/octet-stream";
  const disposition = !forceDownload && INLINE_EXTENSIONS.has(ext) ? "inline" : "attachment";
  return { contentType, disposition };
}
