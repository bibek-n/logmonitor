import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireCodeQualityPermission, isCqSession } from "@/lib/requireCodeQualityPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { updateIssueSchema } from "@/lib/codeQualityShared";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cq = await requireCodeQualityPermission("cq_view");
  if (!isCqSession(cq)) return cq;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) return NextResponse.json({ ok: false, error: "Invalid issue id" }, { status: 400 });

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query(`
    SELECT
      i.Id, i.IssueNumber, i.Title, i.Description, i.Category, i.RuleCode, i.FilePath, i.StartLine, i.EndLine,
      i.CodeElement, i.Severity, i.Status, i.ConfidenceLevel, i.Recommendation, i.CodeSnippet, i.ResolutionNote,
      i.ProjectId, p.Name AS ProjectName, p.Language,
      i.ScanId, s.Branch AS ScanBranch, CONVERT(VARCHAR(19), s.StartedAt, 126) AS ScanStartedAt,
      ru.Username AS ResolvedByUsername,
      CONVERT(VARCHAR(19), i.CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), i.UpdatedAt, 126) AS UpdatedAt
    FROM CodeQualityIssues i
    JOIN CodeQualityProjects p ON p.Id = i.ProjectId
    JOIN CodeQualityScans s ON s.Id = i.ScanId
    LEFT JOIN Users ru ON ru.Id = i.ResolvedByUserId
    WHERE i.Id = @id
  `);
  const issue = result.recordset[0];
  if (!issue) return NextResponse.json({ ok: false, error: "Issue not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data: issue });
}

// Status transitions and resolution notes only - the module never touches source code (see
// the Issue Details security requirement: "Do not automatically modify or delete source
// code").
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cq = await requireCodeQualityPermission("cq_issue_update");
  if (!isCqSession(cq)) return cq;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) return NextResponse.json({ ok: false, error: "Invalid issue id" }, { status: 400 });

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query<{ Id: number }>("SELECT Id FROM CodeQualityIssues WHERE Id = @id");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Issue not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateIssueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request body." }, { status: 400 });
  }
  const input = parsed.data;
  if (input.status === undefined && input.resolutionNote === undefined) {
    return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
  }

  const setClauses: string[] = ["UpdatedAt = SYSUTCDATETIME()"];
  const request = db.request().input("id", sql.Int, id);

  if (input.status !== undefined) {
    setClauses.push("Status = @status");
    request.input("status", sql.VarChar, input.status);
    if (input.status === "Resolved") {
      setClauses.push("ResolvedByUserId = @resolvedByUserId");
      request.input("resolvedByUserId", sql.Int, cq.userId);
    }
  }
  if (input.resolutionNote !== undefined) {
    setClauses.push("ResolutionNote = @resolutionNote");
    request.input("resolutionNote", sql.NVarChar, input.resolutionNote);
  }

  await request.query(`UPDATE CodeQualityIssues SET ${setClauses.join(", ")} WHERE Id = @id`);
  await logAdminAction({ admin: cq, section: "code-quality", action: "update_issue", details: `Issue #${id}${input.status ? ` -> ${input.status}` : ""}`, req });

  return NextResponse.json({ ok: true });
}
