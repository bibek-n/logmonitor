import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { buildWebsitePerformanceListFilters, performanceStatusFor, type WebsitePerformanceListRow } from "@/lib/websitePerformance/shared";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 200;

// Reads FROM the existing Websites table used by the Audit/SSL tools - no new website
// registry. Environment/Owner/Group/Tag columns don't exist anywhere in this schema (recon
// confirmed Websites only ever grew a Name/Url/Enabled), so those filters from the original
// spec aren't offered here rather than being faked against nonexistent data.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize")) || PAGE_SIZE_DEFAULT));
  const offset = (page - 1) * pageSize;

  const { conditions, params, error } = buildWebsitePerformanceListFilters(sp);
  if (error) return NextResponse.json({ ok: false, error }, { status: 400 });
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const db = await getDb();

  const baseFrom = `
    FROM Websites w
    LEFT JOIN WebsitePerformanceConfigs cfg ON cfg.WebsiteId = w.Id
    OUTER APPLY (
      SELECT TOP 1 s.OverallScore, s.Status AS ScanStatus, s.Device, s.CreatedAt
      FROM WebsitePerformanceScans s
      WHERE s.WebsiteId = w.Id
      ORDER BY s.CreatedAt DESC
    ) latest
    OUTER APPLY (
      SELECT TOP 1 a.SecurityScore, a.RiskLevel
      FROM WebsiteAuditScans a
      WHERE a.WebsiteId = w.Id AND a.Status = 'Completed'
      ORDER BY a.ScanDate DESC
    ) audit
  `;

  const countRequest = db.request();
  for (const p of params) countRequest.input(p.name, p.type, p.value);
  const countResult = await countRequest.query<{ Total: number }>(`SELECT COUNT(*) AS Total ${baseFrom} ${where}`);
  const total = countResult.recordset[0]?.Total ?? 0;

  const rowsRequest = db.request();
  for (const p of params) rowsRequest.input(p.name, p.type, p.value);
  rowsRequest.input("offset", sql.Int, offset);
  rowsRequest.input("pageSize", sql.Int, pageSize);
  const rowsResult = await rowsRequest.query<WebsitePerformanceListRow>(`
    SELECT w.Id, w.Name, w.Url, w.Enabled,
      ISNULL(cfg.Enabled, 0) AS PerfEnabled,
      cfg.TestDevice,
      latest.OverallScore AS LatestScore,
      latest.ScanStatus AS LatestScanStatus,
      CONVERT(VARCHAR(19), latest.CreatedAt, 126) AS LatestTestedAt,
      audit.SecurityScore AS LatestAuditScore,
      audit.RiskLevel AS LatestAuditRiskLevel
    ${baseFrom} ${where}
    ORDER BY w.Name
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  const data = rowsResult.recordset.map((row) => ({ ...row, LatestStatus: performanceStatusFor(row.LatestScore) }));

  return NextResponse.json({
    ok: true,
    data,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
