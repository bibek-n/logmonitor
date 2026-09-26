import type { HistoryFilters } from "./queries";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OS_VALUES = ["windows", "linux", "darwin"];

// Shared by the history list and CSV export routes so both apply identical, validated filters.
export function parseHistoryFilters(p: URLSearchParams): Omit<HistoryFilters, "page" | "pageSize"> {
  const from = p.get("from") ?? "";
  const to = p.get("to") ?? "";
  const os = p.get("os") ?? "";
  return {
    from: DATE_RE.test(from) ? from : undefined,
    to: DATE_RE.test(to) ? to : undefined,
    deviceId: (p.get("deviceId") ?? "").slice(0, 40) || undefined,
    q: (p.get("q") ?? "").trim().slice(0, 100) || undefined,
    os: OS_VALUES.includes(os) ? os : undefined,
    eventType: (p.get("eventType") ?? "").slice(0, 30) || undefined,
    actor: (p.get("actor") ?? "").trim().slice(0, 100) || undefined,
    incident: (p.get("incident") ?? "").trim().slice(0, 20) || undefined,
  };
}
