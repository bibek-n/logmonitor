import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isBrowserActivitySession, requireBrowserActivityPermission } from "@/lib/requireBrowserActivityPermission";
import { listEvents, type EventFilter } from "@/lib/browserActivity/repository";

// Viewing/searching this list IS the sensitive action for a monitoring module (see the
// approved plan) - every GET is logged to AdminAuditLog, not just mutations elsewhere in
// this module. A plain unfiltered page load logs as "view"; any filter present logs as
// "search" so the audit trail can distinguish someone browsing everything from someone
// looking up a specific employee/domain.
export async function GET(req: NextRequest) {
  const ba = await requireBrowserActivityPermission("ba_view");
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
    page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined,
    pageSize: url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined,
  };

  const hasFilter = Object.entries(filter).some(([key, value]) => key !== "page" && key !== "pageSize" && value !== undefined);
  const result = await listEvents(filter);

  // Page titles are masked here (not just hidden in the UI) unless the caller holds
  // ba_view_page_titles - field-level least privilege enforced server-side, so a client
  // can't work around a hidden UI element to still read the raw response.
  const titlesCheck = await requireBrowserActivityPermission("ba_view_page_titles");
  const canViewTitles = isBrowserActivitySession(titlesCheck);
  const events = canViewTitles ? result.events : result.events.map((e) => ({ ...e, pageTitle: e.pageTitle ? "•••" : null }));

  await logAdminAction({
    admin: ba,
    section: "browser-activity",
    action: hasFilter ? "search" : "view",
    details: hasFilter ? JSON.stringify(filter) : undefined,
    req,
  });

  return NextResponse.json({ ok: true, data: { events, total: result.total } });
}
