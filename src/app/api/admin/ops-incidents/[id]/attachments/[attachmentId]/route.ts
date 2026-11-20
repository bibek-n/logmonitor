import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireOpsIncidentsPermission, isOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { readIncidentAttachment, deleteIncidentAttachment, resolveAttachmentServing } from "@/lib/opsIncidents/attachments";

interface StoredAttachment {
  FilePath: string;
  OriginalFileName: string;
  ContentType: string | null;
}

// The only way an uploaded attachment is ever reachable - never served from a public path,
// same gating principle as the Knowledge Base document download route.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const oi = await requireOpsIncidentsPermission("oi_view");
  if (!isOpsIncidentsSession(oi)) return oi;

  const { id, attachmentId } = await params;
  const incidentId = Number(id);
  const attId = Number(attachmentId);
  if (!Number.isInteger(incidentId) || !Number.isInteger(attId)) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, attId).input("incidentId", sql.Int, incidentId).query<StoredAttachment>(
    "SELECT FilePath, OriginalFileName, ContentType FROM OpsIncidentAttachments WHERE Id = @id AND IncidentId = @incidentId"
  );
  const doc = result.recordset[0];
  if (!doc) return NextResponse.json({ ok: false, error: "Attachment not found." }, { status: 404 });

  const forceDownload = req.nextUrl.searchParams.get("download") === "1";
  const { contentType, disposition } = resolveAttachmentServing(doc.OriginalFileName, doc.ContentType, forceDownload);
  const bytes = await readIncidentAttachment(doc.FilePath);
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": contentType, "Content-Disposition": `${disposition}; filename="${doc.OriginalFileName}"` },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const oi = await requireOpsIncidentsPermission("oi_manage");
  if (!isOpsIncidentsSession(oi)) return oi;

  const { id, attachmentId } = await params;
  const incidentId = Number(id);
  const attId = Number(attachmentId);
  if (!Number.isInteger(incidentId) || !Number.isInteger(attId)) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, attId).input("incidentId", sql.Int, incidentId).query<StoredAttachment>(
    "SELECT FilePath, OriginalFileName, ContentType FROM OpsIncidentAttachments WHERE Id = @id AND IncidentId = @incidentId"
  );
  const doc = result.recordset[0];
  if (!doc) return NextResponse.json({ ok: false, error: "Attachment not found." }, { status: 404 });

  await db.request().input("id", sql.Int, attId).query("DELETE FROM OpsIncidentAttachments WHERE Id = @id");
  await deleteIncidentAttachment(doc.FilePath);

  await logAdminAction({ admin: oi, section: "ops-incidents", action: "incident_attachment_delete", details: `Incident #${incidentId}: ${doc.OriginalFileName}`, req });
  return NextResponse.json({ ok: true });
}
