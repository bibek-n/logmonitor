import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 200;

// Server-side filtering + pagination throughout - the spec is explicit that the entire
// event table must never be loaded into the browser, so every filter below is a WHERE
// clause, not a client-side array filter.
export async function GET(req: NextRequest) {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize")) || PAGE_SIZE_DEFAULT));
  const offset = (page - 1) * pageSize;

  const sourceIp = sp.get("sourceIp");
  const dataSource = sp.get("dataSource");
  const method = sp.get("method");
  const status = sp.get("status");
  const path = sp.get("path");
  const from = sp.get("from");
  const to = sp.get("to");
  const hasAlertOnly = sp.get("hasAlert") === "true";
  const protectedApplicationId = sp.get("protectedApplicationId");

  const clauses: string[] = [];
  if (sourceIp) clauses.push("e.SourceIp = @sourceIp");
  if (dataSource) clauses.push("e.DataSource = @dataSource");
  if (method) clauses.push("e.RequestMethod = @method");
  if (status) clauses.push("e.ResponseStatus = @status");
  if (path) clauses.push("e.RequestPath LIKE @path");
  if (from) clauses.push("e.EventTime >= @from");
  if (to) clauses.push("e.EventTime <= @to");
  if (hasAlertOnly) clauses.push("e.AlertId IS NOT NULL");
  if (protectedApplicationId) clauses.push("e.ProtectedApplicationId = @protectedApplicationId");
  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const db = await getDb();

  function buildRequest() {
    const request = db.request();
    if (sourceIp) request.input("sourceIp", sql.VarChar, sourceIp);
    if (dataSource) request.input("dataSource", sql.VarChar, dataSource);
    if (method) request.input("method", sql.VarChar, method);
    if (status) request.input("status", sql.Int, Number(status));
    if (path) request.input("path", sql.NVarChar, `%${path}%`);
    if (from) request.input("from", sql.DateTime2, new Date(from));
    if (to) request.input("to", sql.DateTime2, new Date(to));
    if (protectedApplicationId) request.input("protectedApplicationId", sql.Int, Number(protectedApplicationId));
    return request;
  }

  const countResult = await buildRequest().query<{ total: number }>(`SELECT COUNT(*) AS total FROM SecurityEvents e ${whereClause}`);
  const total = countResult.recordset[0].total;

  const rowsResult = await buildRequest().input("offset", sql.Int, offset).input("pageSize", sql.Int, pageSize).query(`
    SELECT e.Id, e.DataSource, CONVERT(VARCHAR(19), e.EventTime, 126) AS EventTime, e.SourceIp, e.DestinationHost, e.RequestMethod, e.RequestPath, e.ResponseStatus, e.UserAgent, e.UserAccount, e.EvidenceSummary, e.AlertId, e.ProtectedApplicationId, pa.Name AS ProtectedApplicationName
    FROM SecurityEvents e
    LEFT JOIN SecurityProtectedApplications pa ON pa.Id = e.ProtectedApplicationId
    ${whereClause}
    ORDER BY e.EventTime DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return NextResponse.json({
    ok: true,
    data: rowsResult.recordset,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
