import { NextRequest, NextResponse } from "next/server";
import { requireSecurityUpdatesPermission, isSecurityUpdatesSession } from "@/lib/requireSecurityUpdatesPermission";
import { exportHistory } from "@/lib/securityUpdates/queries";
import { parseHistoryFilters } from "@/lib/securityUpdates/filters";
import { rowsToCsv } from "@/lib/csv";
import { logAdminAction } from "@/lib/adminAudit";

// CSV of the update history under the same filters as the on-screen table (capped at 5000 rows).
export async function GET(req: NextRequest) {
  const su = await requireSecurityUpdatesPermission("su_export");
  if (!isSecurityUpdatesSession(su)) return su;

  const filters = { ...parseHistoryFilters(req.nextUrl.searchParams), page: 1, pageSize: 5000 };

  const rows = await exportHistory(filters);
  const csv = rowsToCsv(
    ["Time (UTC)", "Device", "OS", "Event", "Category", "Title", "Detail", "Actor", "Incident"],
    rows.map((r) => [r.createdAt.replace("T", " "), r.hostname ?? "", r.os ?? "", r.eventType, r.category ?? "", r.title ?? "", r.detail ?? "", r.actor ?? "", r.incidentNumber ?? ""])
  );

  await logAdminAction({ admin: su, section: "security-updates", action: "export_history", details: `${rows.length} rows`, req });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="update-history-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
