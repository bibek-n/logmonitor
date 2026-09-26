import { NextRequest, NextResponse } from "next/server";
import { requireServerRoomPermission, isServerRoomSession } from "@/lib/requireServerRoomPermission";
import { exportAudit } from "@/lib/serverRoom/service";
import { auditFilters } from "@/lib/serverRoom/http";
import { rowsToCsv } from "@/lib/csv";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET(req: NextRequest) {
  const sr = await requireServerRoomPermission("sr_export");
  if (!isServerRoomSession(sr)) return sr;
  const rows = await exportAudit({ ...auditFilters(req.nextUrl.searchParams), page: 1, pageSize: 5000 });
  const csv = rowsToCsv(
    ["Time (UTC)", "Source", "Event", "Staff", "By", "Device", "OS", "Task type", "Incident", "Detail", "Started (UTC)", "Completed (UTC)"],
    rows.map((r) => [r.at.replace("T", " "), r.source, r.eventType, r.staff ?? "", r.actor ?? "", r.device ?? "", r.os ?? "", r.taskType ?? "", r.incidentNumber ?? "", r.detail ?? "", (r.startedAt ?? "").replace("T", " "), (r.completedAt ?? "").replace("T", " ")])
  );
  await logAdminAction({ admin: sr, section: "server-room", action: "export_audit", details: `${rows.length} rows`, req });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="server-room-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
