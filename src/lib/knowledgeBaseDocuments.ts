import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

// Same storage convention as src/lib/complianceEvidence.ts (which itself follows
// src/lib/qaAttachments.ts / src/lib/ticketAttachments.ts): outside the web root, UUID
// filename on disk (original name kept in the KnowledgeBaseDocuments row), only ever
// reachable via an authenticated GET route that streams the bytes - never a public path.
const STORAGE_ROOT = path.join(process.cwd(), "knowledge-base-documents");

const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".png", ".jpg", ".jpeg", ".zip"]);
export const MAX_KB_DOCUMENT_BYTES = 25 * 1024 * 1024;

export function validateKbDocumentFile(filename: string, size: number): { ok: boolean; error?: string } {
  if (size > MAX_KB_DOCUMENT_BYTES) return { ok: false, error: "File must be 25 MB or smaller." };
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return { ok: false, error: "Unsupported file type. Allowed: PDF, Word, Excel, PowerPoint, text/CSV, image, zip." };
  return { ok: true };
}

export async function saveKbDocumentFile(buffer: Buffer, originalName: string): Promise<string> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const ext = path.extname(originalName).toLowerCase();
  const filePath = path.join(STORAGE_ROOT, `${crypto.randomUUID()}${ext}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function readKbDocumentFile(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

export async function deleteKbDocumentFile(filePath: string): Promise<void> {
  await fs.unlink(filePath).catch(() => {
    // Already gone (or never existed) - deleting the DB row should still succeed either way.
  });
}

// File types a browser can render natively - clicking their link opens the document itself
// (Content-Disposition: inline) instead of forcing a download, which is what a new hire
// skimming a troubleshooting PDF actually wants. Word/Excel/PowerPoint/zip have no in-browser
// renderer, so those stay "attachment" regardless.
const INLINE_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".txt", ".csv"]);

// Fallback only for when the browser didn't supply a usable MIME type at upload time (some
// browsers send "" for certain extensions) - without a correct Content-Type, a browser won't
// render even an inline-disposed PDF/image, it'll just prompt to save an untyped blob.
const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

// Resolves the Content-Type and Content-Disposition to serve a document with. `forceDownload`
// (the download route's own "Download" button, as opposed to clicking the file name) always
// forces attachment regardless of type.
export function resolveKbDocumentServing(originalFileName: string, storedContentType: string | null, forceDownload: boolean): { contentType: string; disposition: "inline" | "attachment" } {
  const ext = path.extname(originalFileName).toLowerCase();
  const contentType = storedContentType || EXTENSION_CONTENT_TYPES[ext] || "application/octet-stream";
  const disposition = !forceDownload && INLINE_EXTENSIONS.has(ext) ? "inline" : "attachment";
  return { contentType, disposition };
}
