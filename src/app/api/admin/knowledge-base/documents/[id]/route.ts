import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireKnowledgeBasePermission, isKnowledgeBaseSession } from "@/lib/requireKnowledgeBasePermission";
import { logAdminAction } from "@/lib/adminAudit";
import { validateKbDocumentFile, saveKbDocumentFile, readKbDocumentFile, deleteKbDocumentFile, resolveKbDocumentServing } from "@/lib/knowledgeBaseDocuments";

// KB_CATEGORIES is offered as the dropdown's presets, but the client also accepts a custom
// category typed by the uploader (the "+ Add a new category..." option) - matches Server Room's
// reason/task field, which took the same request. Category is VARCHAR(50) on the table.
function validCategory(c: string): boolean {
  const v = c.trim();
  return v.length > 0 && v.length <= 50;
}

interface StoredDocument {
  FilePath: string;
  OriginalFileName: string;
  ContentType: string | null;
  Title: string;
}

// The only way an uploaded document is ever reachable - never served from a public path, same
// gating principle as /api/admin/compliance/evidence/[id]/route.ts. Types the browser can render
// (PDF, images, text/CSV) open inline in a new tab instead of forcing a download - pass
// ?download=1 (the client's explicit "Download" button) to force a real download regardless.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const kb = await requireKnowledgeBasePermission("kb_view");
  if (!isKnowledgeBaseSession(kb)) return kb;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid document id." }, { status: 400 });

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query<StoredDocument>(
    "SELECT FilePath, OriginalFileName, ContentType, Title FROM KnowledgeBaseDocuments WHERE Id = @id"
  );
  const doc = result.recordset[0];
  if (!doc) return NextResponse.json({ ok: false, error: "Document not found." }, { status: 404 });

  const forceDownload = req.nextUrl.searchParams.get("download") === "1";
  const { contentType, disposition } = resolveKbDocumentServing(doc.OriginalFileName, doc.ContentType, forceDownload);
  const bytes = await readKbDocumentFile(doc.FilePath);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${doc.OriginalFileName}"`,
    },
  });
}

// multipart/form-data, all fields optional except the ones being changed: title, description,
// category, tags, file (replaces the stored file - the old one is deleted from disk only after
// the new one is safely written and the DB row updated, so a failed upload never loses the
// existing document).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const kb = await requireKnowledgeBasePermission("kb_manage");
  if (!isKnowledgeBaseSession(kb)) return kb;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid document id." }, { status: 400 });

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query<{ FilePath: string; Title: string }>(
    "SELECT FilePath, Title FROM KnowledgeBaseDocuments WHERE Id = @id"
  );
  const current = existing.recordset[0];
  if (!current) return NextResponse.json({ ok: false, error: "Document not found." }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ ok: false, error: "Invalid form submission." }, { status: 400 });

  const sets: string[] = [];
  const rq = db.request().input("id", sql.Int, id);

  const titleRaw = formData.get("title");
  if (typeof titleRaw === "string") {
    const title = titleRaw.trim().slice(0, 200);
    if (!title) return NextResponse.json({ ok: false, error: "Title cannot be empty." }, { status: 400 });
    rq.input("title", sql.NVarChar, title);
    sets.push("Title = @title");
  }

  const categoryRaw = formData.get("category");
  if (typeof categoryRaw === "string" && categoryRaw) {
    const category = categoryRaw.trim().slice(0, 50);
    if (!validCategory(category)) {
      return NextResponse.json({ ok: false, error: "Enter a category (up to 50 characters)." }, { status: 400 });
    }
    rq.input("category", sql.VarChar, category);
    sets.push("Category = @category");
  }

  if (formData.has("description")) {
    const raw = formData.get("description");
    const description = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 2000) : null;
    rq.input("description", sql.NVarChar, description);
    sets.push("Description = @description");
  }

  if (formData.has("tags")) {
    const raw = formData.get("tags");
    const tags = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 300) : null;
    rq.input("tags", sql.NVarChar, tags);
    sets.push("Tags = @tags");
  }

  let oldFilePathToDelete: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const validation = validateKbDocumentFile(file.name, file.size);
    if (!validation.ok) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const newPath = await saveKbDocumentFile(buffer, file.name);
    oldFilePathToDelete = current.FilePath;

    rq.input("filePath", sql.NVarChar, newPath)
      .input("originalFileName", sql.NVarChar, file.name)
      .input("contentType", sql.NVarChar, file.type || null)
      .input("sizeBytes", sql.Int, file.size);
    sets.push("FilePath = @filePath", "OriginalFileName = @originalFileName", "ContentType = @contentType", "SizeBytes = @sizeBytes");
  }

  if (sets.length === 0) return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  sets.push("UpdatedAt = SYSUTCDATETIME()");

  await rq.query(`UPDATE KnowledgeBaseDocuments SET ${sets.join(", ")} WHERE Id = @id`);
  if (oldFilePathToDelete) await deleteKbDocumentFile(oldFilePathToDelete);

  await logAdminAction({ admin: kb, section: "knowledge-base", action: "document_updated", details: current.Title, req });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const kb = await requireKnowledgeBasePermission("kb_manage");
  if (!isKnowledgeBaseSession(kb)) return kb;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid document id." }, { status: 400 });

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query<{ FilePath: string; Title: string }>(
    "SELECT FilePath, Title FROM KnowledgeBaseDocuments WHERE Id = @id"
  );
  const doc = result.recordset[0];
  if (!doc) return NextResponse.json({ ok: false, error: "Document not found." }, { status: 404 });

  await db.request().input("id", sql.Int, id).query("DELETE FROM KnowledgeBaseDocuments WHERE Id = @id");
  // Only after the DB row is gone - an orphaned file on disk is harmless, but a DB row pointing
  // at a deleted file is a broken download link.
  await deleteKbDocumentFile(doc.FilePath);

  await logAdminAction({ admin: kb, section: "knowledge-base", action: "document_deleted", details: doc.Title, req });
  return NextResponse.json({ ok: true });
}
