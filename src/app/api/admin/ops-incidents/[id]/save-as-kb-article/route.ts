import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireOpsIncidentsPermission, isOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { getIncidentDetail, recordKbArticleSaved } from "@/lib/opsIncidents/repository";
import { generateIncidentSummaryPdf } from "@/lib/opsIncidents/pdf";
import { saveKbDocumentFile } from "@/lib/knowledgeBaseDocuments";

// "After resolution, 'save as KB article' in one click" - generates the same post-incident
// summary PDF the standalone export produces and files it straight into
// KnowledgeBaseDocuments (calling that module's own storage helper directly, not its HTTP
// route - same cross-module-via-lib-function pattern used elsewhere in this app). Gated on
// oi_manage, not kb_manage - the action originates from, and is authorized by, incident
// management; the resulting KB row is then manageable from the Knowledge Base page as usual.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const oi = await requireOpsIncidentsPermission("oi_manage");
  if (!isOpsIncidentsSession(oi)) return oi;

  const { id } = await params;
  const incidentId = Number(id);
  if (!Number.isInteger(incidentId) || incidentId <= 0) return NextResponse.json({ ok: false, error: "Invalid incident id." }, { status: 400 });

  const incident = await getIncidentDetail(incidentId);
  if (!incident) return NextResponse.json({ ok: false, error: "Incident not found." }, { status: 404 });

  const buffer = await generateIncidentSummaryPdf(incident);
  const fileName = `incident-${incidentId}-summary.pdf`;
  const filePath = await saveKbDocumentFile(buffer, fileName);

  const description = [incident.rootCause ? `Root cause: ${incident.rootCause}` : null, incident.fix ? `Fix: ${incident.fix}` : null]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000) || null;
  const tags = [incident.severity, incident.affectedSystem].filter(Boolean).join(", ").slice(0, 300) || null;

  const db = await getDb();
  const result = await db
    .request()
    .input("title", sql.NVarChar, `Incident: ${incident.title}`)
    .input("description", sql.NVarChar, description)
    .input("category", sql.VarChar, "Troubleshooting Guide")
    .input("tags", sql.NVarChar, tags)
    .input("filePath", sql.NVarChar, filePath)
    .input("originalFileName", sql.NVarChar, fileName)
    .input("contentType", sql.NVarChar, "application/pdf")
    .input("sizeBytes", sql.Int, buffer.length)
    .input("uploadedByUserId", sql.Int, oi.userId)
    .input("uploadedByName", sql.NVarChar, oi.username)
    .query<{ Id: number }>(`
      INSERT INTO KnowledgeBaseDocuments (Title, Description, Category, Tags, FilePath, OriginalFileName, ContentType, SizeBytes, UploadedByUserId, UploadedByName)
      OUTPUT INSERTED.Id
      VALUES (@title, @description, @category, @tags, @filePath, @originalFileName, @contentType, @sizeBytes, @uploadedByUserId, @uploadedByName)
    `);
  const kbDocumentId = result.recordset[0].Id;

  await recordKbArticleSaved(incidentId, kbDocumentId, oi);
  await logAdminAction({ admin: oi, section: "ops-incidents", action: "incident_saved_as_kb_article", details: `#${incidentId} -> KB #${kbDocumentId}`, req });

  return NextResponse.json({ ok: true, data: { kbDocumentId } });
}
