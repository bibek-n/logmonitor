import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

// Polled by the PHP tab's client component after it calls php-log-request - reports whichever
// of three states applies: still waiting on the agent (pending=true, no content yet), the
// agent's most recent fetch for this exact (device, version, sapi) with its own timestamp, or
// nothing ever fetched at all (both null).
export async function GET(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { deviceId } = await params;
  const { searchParams } = new URL(req.url);
  const version = searchParams.get("version") ?? "";
  const sapi = searchParams.get("sapi") ?? "";
  if (!version || !sapi) {
    return NextResponse.json({ ok: false, error: "version and sapi query params are required" }, { status: 400 });
  }

  const db = await getDb();

  const pendingResult = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("version", sql.VarChar, version)
    .input("sapi", sql.VarChar, sapi)
    .query<{ Cnt: number }>(
      "SELECT COUNT(*) AS Cnt FROM PendingPhpLogRequests WHERE DeviceId = @deviceId AND Version = @version AND Sapi = @sapi AND FulfilledAt IS NULL"
    );
  const pending = (pendingResult.recordset[0]?.Cnt ?? 0) > 0;

  const contentResult = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("version", sql.VarChar, version)
    .input("sapi", sql.VarChar, sapi)
    .query<{ Content: string | null; ErrorMessage: string | null; FetchedAt: string }>(`
      SELECT Content, ErrorMessage, CONVERT(VARCHAR(19), FetchedAt, 126) AS FetchedAt
      FROM PhpLogContent WHERE DeviceId = @deviceId AND Version = @version AND Sapi = @sapi
    `);
  const row = contentResult.recordset[0] ?? null;

  return NextResponse.json({
    ok: true,
    pending,
    content: row?.Content ?? null,
    error: row?.ErrorMessage ?? null,
    fetchedAt: row?.FetchedAt ?? null,
  });
}
