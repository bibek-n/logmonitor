import { NextResponse } from "next/server";
import { ServerRoomError } from "./service";

// Shared request helpers for the /api/admin/server-room/** routes.

export function fail(err: unknown, label: string) {
  if (err instanceof ServerRoomError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
  }
  console.error(label, err);
  return NextResponse.json({ ok: false, error: "Something went wrong - please try again" }, { status: 500 });
}

export function str(p: URLSearchParams, name: string, max = 100): string | undefined {
  return (p.get(name) ?? "").trim().slice(0, max) || undefined;
}

export function pageParams(p: URLSearchParams, defaultSize = 25) {
  return {
    page: Math.max(1, Number(p.get("page")) || 1),
    pageSize: Math.min(100, Math.max(5, Number(p.get("pageSize")) || defaultSize)),
  };
}

export function auditFilters(p: URLSearchParams) {
  const os = p.get("os") ?? "";
  return {
    from: str(p, "from", 10),
    to: str(p, "to", 10),
    staff: str(p, "staff"),
    device: str(p, "device"),
    taskType: str(p, "taskType"),
    os: ["windows", "linux", "darwin"].includes(os) ? os : undefined,
    incident: str(p, "incident", 20),
    q: str(p, "q"),
  };
}
