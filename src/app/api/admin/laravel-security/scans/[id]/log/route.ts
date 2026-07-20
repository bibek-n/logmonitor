import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireLaravelSecurityPermission, isLsSession } from "@/lib/requireLaravelSecurityPermission";

// Polled by the Scan Details page while a scan is Running - same role as codeQuality's own
// scans/[id]/log/route.ts. `since` (a log row Id) lets the client fetch only new lines on each
// poll instead of the whole log every time.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ls = await requireLaravelSecurityPermission("ls_view");
  if (!isLsSession(ls)) return ls;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid scan id" }, { status: 400 });

  const since = Number(req.nextUrl.searchParams.get("since")) || 0;

  const db = await getDb();
  const scan = await db.request().input("id", sql.Int, id).query<{ Status: string }>("SELECT Status FROM LaravelSecurityScans WHERE Id = @id");
  if (!scan.recordset[0]) return NextResponse.json({ ok: false, error: "Scan not found" }, { status: 404 });

  const log = await db
    .request()
    .input("id", sql.Int, id)
    .input("since", sql.Int, since)
    .query(`
      SELECT Id, Message, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
      FROM LaravelSecurityScanLog WHERE ScanId = @id AND Id > @since
      ORDER BY Id ASC
    `);

  return NextResponse.json({ ok: true, data: { status: scan.recordset[0].Status, lines: log.recordset } });
}
