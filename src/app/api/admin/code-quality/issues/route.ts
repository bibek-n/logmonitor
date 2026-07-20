import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireCodeQualityPermission, isCqSession } from "@/lib/requireCodeQualityPermission";
import { parsePagination } from "@/lib/codeQualityShared";

const SORT_COLUMNS = new Set(["CreatedAt", "Severity", "Category", "Status", "FilePath"]);

export async function GET(req: NextRequest) {
  const cq = await requireCodeQualityPermission("cq_view");
  if (!isCqSession(cq)) return cq;

  const sp = req.nextUrl.searchParams;
  const { page, pageSize, offset } = parsePagination(sp);
  const projectId = sp.get("projectId");
  const scanId = sp.get("scanId");
  const category = sp.get("category");
  const severity = sp.get("severity");
  const status = sp.get("status");
  const language = sp.get("language");
  const ruleCode = sp.get("rule");
  const filePath = sp.get("filePath");
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");
  const search = sp.get("search")?.trim();
  const sortByParam = sp.get("sortBy") ?? "CreatedAt";
  const sortColumn = SORT_COLUMNS.has(sortByParam) ? sortByParam : "CreatedAt";
  const sortDir = sp.get("sortDir") === "asc" ? "ASC" : "DESC";

  const conditions: string[] = ["1 = 1"];
  const db = await getDb();
  const countRequest = db.request();
  const listRequest = db.request();

  function addCondition(clause: string, name: string, type: unknown, value: unknown) {
    conditions.push(clause);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    countRequest.input(name, type as any, value);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listRequest.input(name, type as any, value);
  }

  if (projectId) addCondition("i.ProjectId = @projectId", "projectId", sql.Int, Number(projectId));
  if (scanId) addCondition("i.ScanId = @scanId", "scanId", sql.Int, Number(scanId));
  if (category) addCondition("i.Category = @category", "category", sql.VarChar, category);
  if (severity) addCondition("i.Severity = @severity", "severity", sql.VarChar, severity);
  if (status) addCondition("i.Status = @status", "status", sql.VarChar, status);
  if (language) addCondition("p.Language = @language", "language", sql.NVarChar, language);
  if (ruleCode) addCondition("i.RuleCode = @ruleCode", "ruleCode", sql.NVarChar, ruleCode);
  if (filePath) addCondition("i.FilePath LIKE @filePath", "filePath", sql.NVarChar, `%${filePath}%`);
  if (dateFrom) addCondition("i.CreatedAt >= @dateFrom", "dateFrom", sql.DateTime2, new Date(dateFrom));
  if (dateTo) addCondition("i.CreatedAt <= @dateTo", "dateTo", sql.DateTime2, new Date(dateTo));
  if (search) {
    addCondition(
      "(i.FilePath LIKE @search OR i.CodeElement LIKE @search OR i.RuleCode LIKE @search OR i.Title LIKE @search OR i.Description LIKE @search)",
      "search",
      sql.NVarChar,
      `%${search}%`
    );
  }
  const whereClause = conditions.join(" AND ");

  const countResult = await countRequest.query<{ Total: number }>(`
    SELECT COUNT(*) AS Total FROM CodeQualityIssues i JOIN CodeQualityProjects p ON p.Id = i.ProjectId WHERE ${whereClause}
  `);
  const total = countResult.recordset[0].Total;

  const listResult = await listRequest.input("offset", sql.Int, offset).input("pageSize", sql.Int, pageSize).query(`
    SELECT
      i.Id, i.IssueNumber, i.Title, i.Category, i.RuleCode, i.FilePath, i.StartLine, i.EndLine,
      i.Severity, i.Status, i.ConfidenceLevel,
      i.ProjectId, p.Name AS ProjectName, p.Language,
      i.ScanId,
      CONVERT(VARCHAR(19), i.CreatedAt, 126) AS CreatedAt
    FROM CodeQualityIssues i
    JOIN CodeQualityProjects p ON p.Id = i.ProjectId
    WHERE ${whereClause}
    ORDER BY i.${sortColumn} ${sortDir}
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return NextResponse.json({
    ok: true,
    data: listResult.recordset,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
