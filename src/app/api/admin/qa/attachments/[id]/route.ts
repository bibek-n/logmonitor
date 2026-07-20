import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { readQaAttachment } from "@/lib/qaAttachments";

// The only way a QA attachment is ever reachable — never served from a public path, same
// gating principle as src/app/api/admin/website/tickets/[id]/attachment/route.ts.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const attachmentId = Number(id);
  if (!Number.isInteger(attachmentId)) {
    return NextResponse.json({ ok: false, error: "Invalid attachment id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, attachmentId).query<{ FilePath: string; OriginalFileName: string; ContentType: string | null }>(
    "SELECT FilePath, OriginalFileName, ContentType FROM QaAttachments WHERE Id = @id"
  );
  const attachment = result.recordset[0];
  if (!attachment) {
    return NextResponse.json({ ok: false, error: "Attachment not found." }, { status: 404 });
  }

  const bytes = await readQaAttachment(attachment.FilePath);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.ContentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${attachment.OriginalFileName}"`,
    },
  });
}
