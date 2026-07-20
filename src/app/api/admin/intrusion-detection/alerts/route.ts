import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 200;

export async function GET(req: NextRequest) {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize")) || PAGE_SIZE_DEFAULT));
  const offset = (page - 1) * pageSize;

  const severity = sp.get("severity");
  const status = sp.get("status");
  const category = sp.get("category");
  const sourceIp = sp.get("sourceIp");
  const userAccount = sp.get("userAccount");
  const method = sp.get("method");
  const responseStatus = sp.get("responseStatus");
  const ruleId = sp.get("ruleId");
  const protectedApplicationId = sp.get("protectedApplicationId");
  const path = sp.get("path");
  const from = sp.get("from");
  const to = sp.get("to");

  const clauses: string[] = [];
  if (severity) clauses.push("a.Severity = @severity");
  if (status) clauses.push("a.Status = @status");
  if (category) clauses.push("a.Category = @category");
  if (sourceIp) clauses.push("a.SourceIp = @sourceIp");
  if (userAccount) clauses.push("a.UserAccount = @userAccount");
  if (method) clauses.push("a.RequestMethod = @method");
  if (responseStatus) clauses.push("a.ResponseStatus = @responseStatus");
  if (ruleId) clauses.push("a.RuleId = @ruleId");
  if (protectedApplicationId) clauses.push("a.ProtectedApplicationId = @protectedApplicationId");
  if (path) clauses.push("a.RequestPath LIKE @path");
  if (from) clauses.push("a.CreatedAt >= @from");
  if (to) clauses.push("a.CreatedAt <= @to");
  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const db = await getDb();

  function buildRequest() {
    const request = db.request();
    if (severity) request.input("severity", sql.VarChar, severity);
    if (status) request.input("status", sql.VarChar, status);
    if (category) request.input("category", sql.VarChar, category);
    if (sourceIp) request.input("sourceIp", sql.VarChar, sourceIp);
    if (userAccount) request.input("userAccount", sql.NVarChar, userAccount);
    if (method) request.input("method", sql.VarChar, method);
    if (responseStatus) request.input("responseStatus", sql.Int, Number(responseStatus));
    if (ruleId) request.input("ruleId", sql.Int, Number(ruleId));
    if (protectedApplicationId) request.input("protectedApplicationId", sql.Int, Number(protectedApplicationId));
    if (path) request.input("path", sql.NVarChar, `%${path}%`);
    if (from) request.input("from", sql.DateTime2, new Date(from));
    if (to) request.input("to", sql.DateTime2, new Date(to));
    return request;
  }

  const countResult = await buildRequest().query<{ total: number }>(`SELECT COUNT(*) AS total FROM SecurityAlerts a ${whereClause}`);
  const total = countResult.recordset[0].total;

  const rowsResult = await buildRequest().input("offset", sql.Int, offset).input("pageSize", sql.Int, pageSize).query(`
    SELECT a.Id, a.RuleId, r.Name AS RuleName, a.ProtectedApplicationId, pa.Name AS ProtectedApplicationName, a.Category, a.Severity, a.Confidence, a.RiskScore,
      a.SourceIp, a.DestinationHost, a.RequestMethod, a.RequestPath, a.ResponseStatus, a.UserAgent, a.UserAccount,
      a.Status, a.OccurrenceCount,
      CONVERT(VARCHAR(19), a.FirstSeenAt, 126) AS FirstSeenAt, CONVERT(VARCHAR(19), a.LastSeenAt, 126) AS LastSeenAt,
      CONVERT(VARCHAR(19), a.CreatedAt, 126) AS CreatedAt
    FROM SecurityAlerts a
    LEFT JOIN SecurityDetectionRules r ON r.Id = a.RuleId
    LEFT JOIN SecurityProtectedApplications pa ON pa.Id = a.ProtectedApplicationId
    ${whereClause}
    ORDER BY a.CreatedAt DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return NextResponse.json({
    ok: true,
    data: rowsResult.recordset,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
