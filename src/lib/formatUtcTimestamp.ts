// Every `CreatedAt`-style column in this app is populated via SYSUTCDATETIME() (real UTC),
// and every API route that returns one does `CONVERT(VARCHAR(19), CreatedAt, 126)` -
// producing a string like "2026-09-11T08:51:44" with NO timezone marker at all. A long list
// of "use client" components then rendered that raw string as-is via `.replace("T", " ")`,
// which looks plausible but is still the UTC clock time, silently off from the actual local
// time by the viewer's UTC offset (5h45m for this deployment's Nepal server) - a real,
// user-reported bug (Login Activity times reading hours behind when logins actually
// happened), not a display nicety.
//
// Appends "Z" (marking the string as the UTC instant it actually is) before parsing, then
// renders in the *viewing browser's own local timezone* via toLocaleString() - correct for
// whoever is actually looking at the page, not tied to one hardcoded timezone server-side.
export function formatUtcTimestamp(raw: string | null | undefined): string {
  if (!raw) return "—";
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(raw);
  const date = new Date(hasTimezone ? raw : `${raw}Z`);
  if (Number.isNaN(date.getTime())) return raw.replace("T", " ");
  return date
    .toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}
