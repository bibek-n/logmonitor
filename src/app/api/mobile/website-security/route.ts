import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireMobileAdmin, isMobileSession } from "@/lib/mobileAuth";

interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
  LatestScanId: number | null;
  LatestScanDate: string | null;
  LatestStatus: string | null;
  LatestPlatform: string | null;
  LatestScore: number | null;
  LatestRisk: string | null;
  ScheduleType: string | null;
}

export async function GET(req: NextRequest) {
  const admin = await requireMobileAdmin(req);
  if (!isMobileSession(admin)) return admin;

  try {
    const db = await getDb();
    const result = await db.query<WebsiteRow>(`
      SELECT w.Id, w.Name, w.Url,
             latest.Id AS LatestScanId, latest.ScanDate AS LatestScanDate, latest.Status AS LatestStatus,
             latest.DetectedPlatform AS LatestPlatform, latest.SecurityScore AS LatestScore, latest.RiskLevel AS LatestRisk,
             sched.ScheduleType AS ScheduleType
      FROM Websites w
      OUTER APPLY (
        SELECT TOP 1 s.Id, s.ScanDate, s.Status, s.DetectedPlatform, s.SecurityScore, s.RiskLevel
        FROM WebsiteAuditScans s
        WHERE s.WebsiteId = w.Id
        ORDER BY s.ScanDate DESC, s.Id DESC
      ) latest
      LEFT JOIN WebsiteScanSchedules sched ON sched.WebsiteId = w.Id
      WHERE w.Enabled = 1
      ORDER BY w.Name
    `);
    return NextResponse.json({ ok: true, websites: result.recordset });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to load websites" });
  }
}
