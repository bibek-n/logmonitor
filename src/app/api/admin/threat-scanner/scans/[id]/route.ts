import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import type { ThreatScanRow } from "@/lib/threatScanner/shared";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const scanId = Number(id);
  if (!Number.isInteger(scanId)) return NextResponse.json({ ok: false, error: "Invalid scan id." }, { status: 400 });

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, scanId).query<ThreatScanRow & { ResultJson: string | null; ErrorMessage: string | null }>(`
    SELECT Id, Kind, Target, WebsiteId, VtResourceId, Status, Verdict, MaliciousCount, SuspiciousCount, HarmlessCount,
      UndetectedCount, TimeoutCount, EngineCount, ResultJson, ErrorMessage, OriginalFileName, ContentType, SizeBytes,
      TriggeredByUsername, CONVERT(VARCHAR(19), StartedAt, 126) AS StartedAt,
      CONVERT(VARCHAR(19), CompletedAt, 126) AS CompletedAt, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM ThreatScans WHERE Id = @id
  `);
  const row = result.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "Scan not found." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    data: { ...row, engines: row.ResultJson ? JSON.parse(row.ResultJson) : [] },
  });
}
