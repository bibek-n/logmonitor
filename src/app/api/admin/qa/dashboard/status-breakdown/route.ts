import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";

export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view_reports");
  if (!isQaSession(qa)) return qa;

  const projectIdParam = req.nextUrl.searchParams.get("projectId");
  const projectId = projectIdParam ? Number(projectIdParam) : null;
  if (projectIdParam && !Number.isInteger(projectId)) {
    return NextResponse.json({ ok: false, error: "Invalid projectId." }, { status: 400 });
  }

  const db = await getDb();
  const request = db.request();
  if (projectId) request.input("projectId", sql.Int, projectId);
  const where = projectId ? "WHERE ProjectId = @projectId" : "";

  const result = await request.query<{ Status: string; Cnt: number }>(
    `SELECT Status, COUNT(*) AS Cnt FROM QaTestCases ${where} GROUP BY Status ORDER BY Status ASC`
  );

  return NextResponse.json({ ok: true, data: result.recordset });
}
