import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

// Always responds 200 — see other routes in this app for why (IIS replaces non-2xx bodies).
// Polled by the dashboard's terminal-style progress panel while a manual scan runs.
export async function GET(req: NextRequest, { params }: { params: Promise<{ scanId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { scanId: scanIdParam } = await params;
  const scanId = Number(scanIdParam);
  if (!Number.isInteger(scanId) || scanId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid scan id" });
  }

  const sinceIdParam = req.nextUrl.searchParams.get("sinceId");
  const sinceId = Number(sinceIdParam);
  const hasSinceId = Number.isInteger(sinceId) && sinceId > 0;

  const db = await getDb();

  const scanResult = await db
    .request()
    .input("scanId", sql.Int, scanId)
    .query<{ Id: number; Status: string; SecurityScore: number | null; RiskLevel: string | null }>(
      "SELECT Id, Status, SecurityScore, RiskLevel FROM WebsiteAuditScans WHERE Id = @scanId"
    );
  const scan = scanResult.recordset[0];
  if (!scan) return NextResponse.json({ ok: false, error: "Scan not found" });

  const logResult = await db
    .request()
    .input("scanId", sql.Int, scanId)
    .input("sinceId", sql.Int, hasSinceId ? sinceId : 0)
    .query<{ Id: number; Message: string; CreatedAt: string }>(
      "SELECT Id, Message, CreatedAt FROM WebsiteAuditScanLog WHERE ScanId = @scanId AND Id > @sinceId ORDER BY Id ASC"
    );

  return NextResponse.json({
    ok: true,
    status: scan.Status,
    securityScore: scan.SecurityScore,
    riskLevel: scan.RiskLevel,
    lines: logResult.recordset,
  });
}
