import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { validateQaAttachment, saveQaAttachment, QA_ATTACHMENT_ENTITY_TYPES } from "@/lib/qaAttachments";
import type { QaAttachmentRow } from "@/lib/qaShared";

// Permission required to attach a file depends on which entity it's attached to — a
// TestCase attachment needs qa_edit, a TestExecution attachment needs qa_execute (testers
// attach screenshots while running a case), a Bug attachment needs qa_manage_bugs. Checked
// dynamically rather than a single fixed permission, same "never trust the client" rule the
// rest of this module follows — the entityType decides which grant is required, not the caller.
const PERMISSION_BY_ENTITY: Record<string, string> = {
  TestCase: "qa_edit",
  TestExecution: "qa_execute",
  Bug: "qa_manage_bugs",
};

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ ok: false, error: "Invalid form submission." }, { status: 400 });
  }

  const entityType = String(formData.get("entityType") ?? "");
  const entityId = Number(formData.get("entityId"));
  const file = formData.get("file");

  if (!QA_ATTACHMENT_ENTITY_TYPES.has(entityType)) {
    return NextResponse.json({ ok: false, error: "Invalid entityType." }, { status: 400 });
  }
  if (!Number.isInteger(entityId)) {
    return NextResponse.json({ ok: false, error: "A valid entityId is required." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "A file is required." }, { status: 400 });
  }

  const qa = await requireQaPermission(PERMISSION_BY_ENTITY[entityType]);
  if (!isQaSession(qa)) return qa;

  const validation = validateQaAttachment(file.name, file.size);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const db = await getDb();
  const entityTable = entityType === "TestCase" ? "QaTestCases" : entityType === "TestExecution" ? "QaTestExecutions" : "QaBugs";
  const entityCheck = await db.request().input("id", sql.Int, entityId).query<{ Id: number }>(
    `SELECT Id FROM ${entityTable} WHERE Id = @id`
  );
  if (!entityCheck.recordset[0]) {
    return NextResponse.json({ ok: false, error: `${entityType} not found.` }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = await saveQaAttachment(buffer, file.name);

  const insertResult = await db
    .request()
    .input("entityType", sql.VarChar, entityType)
    .input("entityId", sql.Int, entityId)
    .input("filePath", sql.NVarChar, filePath)
    .input("originalFileName", sql.NVarChar, file.name)
    .input("contentType", sql.NVarChar, file.type || null)
    .input("sizeBytes", sql.Int, file.size)
    .input("uploadedByUserId", sql.Int, qa.userId)
    .query<QaAttachmentRow>(`
      INSERT INTO QaAttachments (EntityType, EntityId, FilePath, OriginalFileName, ContentType, SizeBytes, UploadedByUserId)
      OUTPUT INSERTED.Id, INSERTED.EntityType, INSERTED.EntityId, INSERTED.FilePath,
        INSERTED.OriginalFileName, INSERTED.ContentType, INSERTED.SizeBytes, INSERTED.UploadedByUserId,
        CONVERT(VARCHAR(19), INSERTED.UploadedAt, 126) AS UploadedAt
      VALUES (@entityType, @entityId, @filePath, @originalFileName, @contentType, @sizeBytes, @uploadedByUserId)
    `);
  const attachment = insertResult.recordset[0];

  await logAdminAction({ admin: qa, section: "qa", action: "upload_attachment", details: `${entityType} ${entityId}: ${file.name}`, req });
  await logQaActivity({ entityType, entityId, action: "attach", userId: qa.userId, newValue: { fileName: file.name, sizeBytes: file.size }, req });

  return NextResponse.json({ ok: true, data: attachment });
}

export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const sp = req.nextUrl.searchParams;
  const entityType = sp.get("entityType") ?? "";
  const entityId = Number(sp.get("entityId"));

  if (!QA_ATTACHMENT_ENTITY_TYPES.has(entityType)) {
    return NextResponse.json({ ok: false, error: "Invalid entityType." }, { status: 400 });
  }
  if (!Number.isInteger(entityId)) {
    return NextResponse.json({ ok: false, error: "A valid entityId is required." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("entityType", sql.VarChar, entityType).input("entityId", sql.Int, entityId).query<QaAttachmentRow>(`
    SELECT Id, EntityType, EntityId, FilePath, OriginalFileName, ContentType, SizeBytes, UploadedByUserId,
      CONVERT(VARCHAR(19), UploadedAt, 126) AS UploadedAt
    FROM QaAttachments WHERE EntityType = @entityType AND EntityId = @entityId
    ORDER BY UploadedAt DESC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}
