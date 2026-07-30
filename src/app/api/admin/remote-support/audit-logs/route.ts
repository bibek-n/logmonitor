import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireRemoteSupportPermission, isRemoteSupportSession } from "@/lib/requireRemoteSupportPermission";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

// remote_support_admin only - this exposes every admin's session history across every device,
// not just the caller's own requests (see sessions/[id]/route.ts for the "own session or
// Admin role" scoping used elsewhere in this module).
export async function GET(req: NextRequest) {
  const rs = await requireRemoteSupportPermission("remote_support_admin");
  if (!isRemoteSupportSession(rs)) return rs;

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("deviceId");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(searchParams.get("pageSize")) || PAGE_SIZE_DEFAULT));
  const offset = (page - 1) * pageSize;

  const db = await getDb();
  const request = db.request().input("offset", sql.Int, offset).input("pageSize", sql.Int, pageSize);
  const whereClause = deviceId ? "WHERE rss.DeviceId = @deviceId" : "";
  if (deviceId) request.input("deviceId", sql.VarChar, deviceId);

  const result = await request.query(`
    SELECT rss.Id AS SessionId, rss.SessionGuid, rss.DeviceId, d.Hostname, u.Username AS RequestedBy,
      rss.Reason, rss.Status, rss.PermissionsGranted, rss.SourceIp, rss.RequestedAt, rss.RespondedAt,
      rss.StartedAt, rss.EndedAt, rss.TerminationReason
    FROM RemoteSupportSessions rss
    LEFT JOIN Devices d ON d.DeviceId = rss.DeviceId
    LEFT JOIN Users u ON u.Id = rss.RequestedByUserId
    ${whereClause}
    ORDER BY rss.Id DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return NextResponse.json({ ok: true, sessions: result.recordset, page, pageSize });
}
