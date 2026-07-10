import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

// Ticket attachments come from an unauthenticated public upload (the ticket submission
// form has no login) — stored outside the web root and only reachable via the
// authenticated admin ticket-detail route, same access-gating principle as endpoint-agent
// screenshots (src/lib/screenshotStorage.ts), though without encryption at rest since
// these are ordinary support-request attachments, not surveillance data.
const STORAGE_ROOT = path.join(process.cwd(), "ticket-attachments");

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".doc", ".docx", ".txt"]);
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function validateAttachment(filename: string, size: number): { ok: boolean; error?: string } {
  if (size > MAX_ATTACHMENT_BYTES) return { ok: false, error: "Attachment must be 10 MB or smaller." };
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return { ok: false, error: "Unsupported attachment type." };
  return { ok: true };
}

export async function saveTicketAttachment(buffer: Buffer, originalName: string): Promise<string> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const ext = path.extname(originalName).toLowerCase();
  const filePath = path.join(STORAGE_ROOT, `${crypto.randomUUID()}${ext}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function readTicketAttachment(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}
