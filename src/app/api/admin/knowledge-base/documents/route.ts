import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireKnowledgeBasePermission, isKnowledgeBaseSession } from "@/lib/requireKnowledgeBasePermission";
import { logAdminAction } from "@/lib/adminAudit";
import { validateKbDocumentFile, saveKbDocumentFile } from "@/lib/knowledgeBaseDocuments";

const iso = (col: string) => `CONVERT(VARCHAR(19), ${col}, 126)`;

// KB_CATEGORIES is offered as the dropdown's presets, but the client also accepts a custom
// category typed by the uploader (the "+ Add a new category..." option) - matches Server Room's
// reason/task field, which took the same request. Category is VARCHAR(50) on the table.
function validCategory(c: string): boolean {
  const v = c.trim();
  return v.length > 0 && v.length <= 50;
}

interface DocumentRow {
  Id: number;
  Title: string;
  Description: string | null;
  Category: string;
  Tags: string | null;
  OriginalFileName: string;
  ContentType: string | null;
  SizeBytes: number;
  UploadedByName: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

// List + search - a new hire browsing for "how is the mail server configured" needs a search
// box more than a filing structure, so this is one flat list with a free-text query (matches
// Title/Description/Tags) plus an optional Category filter, not a folder tree.
export async function GET(req: NextRequest) {
  const kb = await requireKnowledgeBasePermission("kb_view");
  if (!isKnowledgeBaseSession(kb)) return kb;

  const p = req.nextUrl.searchParams;
  const q = (p.get("q") ?? "").trim().slice(0, 200);
  const category = p.get("category") ?? "";
  const page = Math.max(1, Number(p.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(p.get("pageSize")) || 25));

  const db = await getDb();
  const where = ["1 = 1"];
  const cq = db.request();
  const rq = db.request();
  if (q) {
    const like = `%${q}%`;
    cq.input("q", sql.NVarChar, like);
    rq.input("q", sql.NVarChar, like);
    where.push("(Title LIKE @q OR Description LIKE @q OR Tags LIKE @q OR OriginalFileName LIKE @q)");
  }
  if (category && validCategory(category)) {
    cq.input("category", sql.VarChar, category);
    rq.input("category", sql.VarChar, category);
    where.push("Category = @category");
  }
  const whereSql = where.join(" AND ");

  const total = await cq.query<{ Cnt: number }>(`SELECT COUNT(*) AS Cnt FROM KnowledgeBaseDocuments WHERE ${whereSql}`);
  rq.input("offset", sql.Int, (page - 1) * pageSize).input("pageSize", sql.Int, pageSize);
  const rows = await rq.query<DocumentRow>(`
    SELECT Id, Title, Description, Category, Tags, OriginalFileName, ContentType, SizeBytes, UploadedByName,
      ${iso("CreatedAt")} AS CreatedAt, ${iso("UpdatedAt")} AS UpdatedAt
    FROM KnowledgeBaseDocuments WHERE ${whereSql}
    ORDER BY UpdatedAt DESC, Id DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return NextResponse.json({
    ok: true,
    total: total.recordset[0]?.Cnt ?? 0,
    data: rows.recordset.map((r) => ({
      id: r.Id,
      title: r.Title,
      description: r.Description,
      category: r.Category,
      tags: r.Tags,
      fileName: r.OriginalFileName,
      contentType: r.ContentType,
      sizeBytes: r.SizeBytes,
      uploadedBy: r.UploadedByName,
      createdAt: r.CreatedAt,
      updatedAt: r.UpdatedAt,
    })),
  });
}

// multipart/form-data: title, description?, category, tags?, file.
export async function POST(req: NextRequest) {
  const kb = await requireKnowledgeBasePermission("kb_manage");
  if (!isKnowledgeBaseSession(kb)) return kb;

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ ok: false, error: "Invalid form submission." }, { status: 400 });

  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  if (!title) return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });

  const category = String(formData.get("category") ?? "").trim().slice(0, 50);
  if (!validCategory(category)) {
    return NextResponse.json({ ok: false, error: "Enter a category (up to 50 characters)." }, { status: 400 });
  }

  const descriptionRaw = formData.get("description");
  const description = typeof descriptionRaw === "string" && descriptionRaw.trim() ? descriptionRaw.trim().slice(0, 2000) : null;

  const tagsRaw = formData.get("tags");
  const tags = typeof tagsRaw === "string" && tagsRaw.trim() ? tagsRaw.trim().slice(0, 300) : null;

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "A file is required." }, { status: 400 });

  const validation = validateKbDocumentFile(file.name, file.size);
  if (!validation.ok) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = await saveKbDocumentFile(buffer, file.name);

  const db = await getDb();
  const result = await db
    .request()
    .input("title", sql.NVarChar, title)
    .input("description", sql.NVarChar, description)
    .input("category", sql.VarChar, category)
    .input("tags", sql.NVarChar, tags)
    .input("filePath", sql.NVarChar, filePath)
    .input("originalFileName", sql.NVarChar, file.name)
    .input("contentType", sql.NVarChar, file.type || null)
    .input("sizeBytes", sql.Int, file.size)
    .input("uploadedByUserId", sql.Int, kb.userId)
    .input("uploadedByName", sql.NVarChar, kb.username)
    .query<{ Id: number }>(`
      INSERT INTO KnowledgeBaseDocuments (Title, Description, Category, Tags, FilePath, OriginalFileName, ContentType, SizeBytes, UploadedByUserId, UploadedByName)
      OUTPUT INSERTED.Id
      VALUES (@title, @description, @category, @tags, @filePath, @originalFileName, @contentType, @sizeBytes, @uploadedByUserId, @uploadedByName)
    `);
  const id = result.recordset[0].Id;

  await logAdminAction({ admin: kb, section: "knowledge-base", action: "document_uploaded", details: `${title} (${file.name})`, req });
  return NextResponse.json({ ok: true, id });
}
