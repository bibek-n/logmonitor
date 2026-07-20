import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

// Same storage convention as src/lib/ticketAttachments.ts: outside the web root, UUID
// filename on disk (original name kept in the QaAttachments row), only ever reachable via
// an authenticated GET route that streams the bytes. QaAttachments is a single polymorphic
// table (EntityType/EntityId covering TestCase/TestExecution/Bug) so this storage helper is
// shared across all three rather than duplicated per entity type.
const STORAGE_ROOT = path.join(process.cwd(), "qa-attachments");

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".doc", ".docx", ".txt", ".csv", ".log", ".zip"]);
export const MAX_QA_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export const QA_ATTACHMENT_ENTITY_TYPES = new Set(["TestCase", "TestExecution", "Bug"]);

export function validateQaAttachment(filename: string, size: number): { ok: boolean; error?: string } {
  if (size > MAX_QA_ATTACHMENT_BYTES) return { ok: false, error: "Attachment must be 15 MB or smaller." };
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return { ok: false, error: "Unsupported attachment type." };
  return { ok: true };
}

export async function saveQaAttachment(buffer: Buffer, originalName: string): Promise<string> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const ext = path.extname(originalName).toLowerCase();
  const filePath = path.join(STORAGE_ROOT, `${crypto.randomUUID()}${ext}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function readQaAttachment(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}
