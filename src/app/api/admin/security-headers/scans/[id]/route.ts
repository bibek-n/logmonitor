import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { CORE_HEADERS, UPCOMING_HEADERS } from "@/lib/securityHeaders";

interface ScanDetailRow {
  Id: number;
  WebsiteId: number | null;
  TargetUrl: string;
  FinalUrl: string | null;
  IpAddress: string | null;
  StatusCode: number | null;
  Grade: string;
  Score: number;
  HeadersJson: string;
  MissingHeadersJson: string;
  PresentHeadersJson: string;
  TriggeredByUsername: string | null;
  ScannedAt: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const scanId = Number(id);
  if (!Number.isInteger(scanId) || scanId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid scan id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, scanId).query<ScanDetailRow>(`
    SELECT Id, WebsiteId, TargetUrl, FinalUrl, IpAddress, StatusCode, Grade, Score,
      HeadersJson, MissingHeadersJson, PresentHeadersJson, TriggeredByUsername,
      CONVERT(VARCHAR(19), ScannedAt, 126) AS ScannedAt
    FROM SecurityHeaderScans
    WHERE Id = @id
  `);

  const row = result.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "Scan not found." }, { status: 404 });

  const headers: Record<string, string> = JSON.parse(row.HeadersJson);
  const missing: string[] = JSON.parse(row.MissingHeadersJson);
  const present: string[] = JSON.parse(row.PresentHeadersJson);

  return NextResponse.json({
    ok: true,
    report: {
      id: row.Id,
      websiteId: row.WebsiteId,
      targetUrl: row.TargetUrl,
      finalUrl: row.FinalUrl,
      ipAddress: row.IpAddress,
      statusCode: row.StatusCode,
      grade: row.Grade,
      score: row.Score,
      headers,
      present,
      missing,
      coreHeaders: CORE_HEADERS,
      upcomingHeaders: UPCOMING_HEADERS,
      triggeredByUsername: row.TriggeredByUsername,
      scannedAt: row.ScannedAt,
    },
  });
}
