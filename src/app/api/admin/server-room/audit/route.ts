import { NextRequest, NextResponse } from "next/server";
import { requireServerRoomPermission, isServerRoomSession } from "@/lib/requireServerRoomPermission";
import { listAudit } from "@/lib/serverRoom/service";
import { auditFilters, fail, pageParams } from "@/lib/serverRoom/http";

// One searchable history: server-room entries, tasks, incident activity AND update scans/installs/failures.
export async function GET(req: NextRequest) {
  const sr = await requireServerRoomPermission("sr_audit");
  if (!isServerRoomSession(sr)) return sr;
  const p = req.nextUrl.searchParams;
  try {
    const result = await listAudit({ ...auditFilters(p), ...pageParams(p) });
    return NextResponse.json({ ok: true, data: result.rows, total: result.total });
  } catch (err) {
    return fail(err, "audit list");
  }
}
