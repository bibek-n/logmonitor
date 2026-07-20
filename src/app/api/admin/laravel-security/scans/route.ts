import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireLaravelSecurityPermission, isLsSession } from "@/lib/requireLaravelSecurityPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { createScanRow, executeScan } from "@/lib/laravelSecurity/runScan";
import { startScanSchema, parsePagination } from "@/lib/laravelSecurityShared";
import { z } from "zod";

const SORT_COLUMNS = new Set(["CreatedAt", "StartedAt", "CompletedAt", "Status", "SecurityScore"]);

export async function GET(req: NextRequest) {
  const ls = await requireLaravelSecurityPermission("ls_view");
  if (!isLsSession(ls)) return ls;

  const sp = req.nextUrl.searchParams;
  const { page, pageSize, offset } = parsePagination(sp);
  const projectId = sp.get("projectId");
  const status = sp.get("status");
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");
  const sortByParam = sp.get("sortBy") ?? "CreatedAt";
  const sortColumn = SORT_COLUMNS.has(sortByParam) ? sortByParam : "CreatedAt";
  const sortDir = sp.get("sortDir") === "asc" ? "ASC" : "DESC";

  const conditions: string[] = ["1 = 1"];
  const db = await getDb();
  const countRequest = db.request();
  const listRequest = db.request();

  if (projectId) {
    conditions.push("s.ProjectId = @projectId");
    countRequest.input("projectId", sql.Int, Number(projectId));
    listRequest.input("projectId", sql.Int, Number(projectId));
  }
  if (status) {
    conditions.push("s.Status = @status");
    countRequest.input("status", sql.VarChar, status);
    listRequest.input("status", sql.VarChar, status);
  }
  if (dateFrom) {
    conditions.push("s.CreatedAt >= @dateFrom");
    countRequest.input("dateFrom", sql.DateTime2, new Date(dateFrom));
    listRequest.input("dateFrom", sql.DateTime2, new Date(dateFrom));
  }
  if (dateTo) {
    conditions.push("s.CreatedAt <= @dateTo");
    countRequest.input("dateTo", sql.DateTime2, new Date(dateTo));
    listRequest.input("dateTo", sql.DateTime2, new Date(dateTo));
  }
  const whereClause = conditions.join(" AND ");

  const countResult = await countRequest.query<{ Total: number }>(`SELECT COUNT(*) AS Total FROM LaravelSecurityScans s WHERE ${whereClause}`);
  const total = countResult.recordset[0].Total;

  const listResult = await listRequest.input("offset", sql.Int, offset).input("pageSize", sql.Int, pageSize).query(`
    SELECT
      s.Id, s.ProjectId, p.Name AS ProjectName, s.Branch, s.ScanType, s.Status,
      u.Username AS StartedByUsername,
      CONVERT(VARCHAR(19), s.StartedAt, 126) AS StartedAt,
      CONVERT(VARCHAR(19), s.CompletedAt, 126) AS CompletedAt,
      s.DurationMs, s.FilesScanned, s.SecurityScore, s.ErrorMessage,
      (SELECT COUNT(*) FROM LaravelSecurityIssues i WHERE i.ScanId = s.Id) AS TotalIssues
    FROM LaravelSecurityScans s
    JOIN LaravelSecurityProjects p ON p.Id = s.ProjectId
    LEFT JOIN Users u ON u.Id = s.StartedByUserId
    WHERE ${whereClause}
    ORDER BY s.${sortColumn} ${sortDir}
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return NextResponse.json({
    ok: true,
    data: listResult.recordset,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}

const startScanRequestSchema = startScanSchema.extend({ projectId: z.number().int().positive() });

// Fire-and-forget, same pattern as codeQuality/scans/route.ts.
export async function POST(req: NextRequest) {
  const ls = await requireLaravelSecurityPermission("ls_scan_start");
  if (!isLsSession(ls)) return ls;

  const body = await req.json().catch(() => null);
  const parsed = startScanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request body." }, { status: 400 });
  }
  const input = parsed.data;

  const db = await getDb();
  const project = await db
    .request()
    .input("id", sql.Int, input.projectId)
    .query<{ Id: number; Status: string }>("SELECT Id, Status FROM LaravelSecurityProjects WHERE Id = @id AND DeletedAt IS NULL");
  if (!project.recordset[0]) return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  if (project.recordset[0].Status !== "Active") {
    return NextResponse.json({ ok: false, error: "Cannot scan an inactive project." }, { status: 400 });
  }

  const inFlight = await db
    .request()
    .input("projectId", sql.Int, input.projectId)
    .query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM LaravelSecurityScans WHERE ProjectId = @projectId AND Status IN ('Pending', 'Queued', 'Running')");
  if (inFlight.recordset[0].Cnt > 0) {
    return NextResponse.json({ ok: false, error: "A scan is already running for this project." }, { status: 409 });
  }

  const scanOptions = {
    projectId: input.projectId,
    branch: input.branch ?? null,
    scanType: input.scanType ?? ("Full" as const),
    startedByUserId: ls.userId,
    overrides: {
      includedDirectories: input.includedDirectories,
      excludedDirectories: input.excludedDirectories,
      enabledRuleCodes: input.enabledRuleCodes,
    },
  };

  const scanId = await createScanRow(scanOptions);
  void executeScan(scanId, scanOptions).catch((err) => {
    console.error(`[laravel-security] scan ${scanId} background execution error:`, err instanceof Error ? err.message : err);
  });

  await logAdminAction({ admin: ls, section: "laravel-security", action: "start_scan", details: `Project #${input.projectId}, scan #${scanId}`, req });

  return NextResponse.json({ ok: true, data: { scanId } }, { status: 202 });
}
