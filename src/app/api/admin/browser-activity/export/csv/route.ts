import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isBrowserActivitySession, requireBrowserActivityPermission } from "@/lib/requireBrowserActivityPermission";
import { rowsToCsv } from "@/lib/csv";
import { listEvents, type EventFilter } from "@/lib/browserActivity/repository";

export async function GET(req: NextRequest) {
  const ba = await requireBrowserActivityPermission("ba_export");
  if (!isBrowserActivitySession(ba)) return ba;

  const url = new URL(req.url);
  const filter: EventFilter = {
    staffId: url.searchParams.get("staffId") ? Number(url.searchParams.get("staffId")) : undefined,
    domain: url.searchParams.get("domain") ?? undefined,
    browser: url.searchParams.get("browser") ?? undefined,
    deviceId: url.searchParams.get("deviceId") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    categoryId: url.searchParams.get("categoryId") ? Number(url.searchParams.get("categoryId")) : undefined,
    riskLevel: url.searchParams.get("riskLevel") ?? undefined,
    pageSize: 5000, // export cap — see the "no silent caps" note: truncation beyond this is intentional and bounded, not silent
  };

  // Page titles are subject to the same field-level gate as the events list — an exporter
  // without ba_view_page_titles gets masked titles in the CSV too, not just in the UI table.
  const titlesCheck = await requireBrowserActivityPermission("ba_view_page_titles");
  const canViewTitles = isBrowserActivitySession(titlesCheck);

  const result = await listEvents(filter);
  const headers = ["Visited At (UTC)", "Employee ID", "Device ID", "Browser", "Domain", "Page Title", "Est. Dwell (s)", "Category", "Risk Level", "Security Event"];
  const rows = result.events.map((e) => [
    e.visitedAt.toISOString(),
    e.staffId ?? "",
    e.deviceId,
    e.browser,
    e.domain,
    canViewTitles ? (e.pageTitle ?? "") : e.pageTitle ? "•••" : "",
    e.dwellSeconds ?? "",
    e.categoryName ?? "Uncategorized",
    e.riskLevel,
    e.isSecurityEvent ? e.securityEventType ?? "yes" : "",
  ]);

  await logAdminAction({
    admin: ba,
    section: "browser-activity",
    action: "export_csv",
    details: JSON.stringify({ ...filter, rowCount: result.events.length }),
    req,
  });

  return new NextResponse(rowsToCsv(headers, rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="browser-activity-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
