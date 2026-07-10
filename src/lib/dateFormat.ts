// Formats a Date using the company-wide preferences stored in CompanySettings
// (DefaultTimezone/DateFormat/TimeFormat/DefaultLanguage — see Dashboard > Company Settings
// > System Settings). DateFormat is a hand-written token string (not a native Intl format),
// so date tokens are substituted manually; TimeFormat/timezone/locale use Intl.DateTimeFormat
// directly since those map cleanly onto its options.
export interface DisplaySettings {
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  locale: string;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  timezone: "UTC",
  dateFormat: "YYYY-MM-DD",
  timeFormat: "24h",
  locale: "en",
};

function getParts(date: Date, timezone: string, locale: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  const monthShort = new Intl.DateTimeFormat(locale, { timeZone: timezone, month: "short" }).format(date);

  return { ...map, monthShort };
}

export function formatDate(date: Date, settings: Pick<DisplaySettings, "timezone" | "dateFormat" | "locale">): string {
  const { timezone, dateFormat, locale } = settings;
  const p = getParts(date, timezone, locale);

  switch (dateFormat) {
    case "MM/DD/YYYY":
      return `${p.month}/${p.day}/${p.year}`;
    case "DD/MM/YYYY":
      return `${p.day}/${p.month}/${p.year}`;
    case "DD-MMM-YYYY":
      return `${p.day}-${p.monthShort}-${p.year}`;
    case "YYYY-MM-DD":
    default:
      return `${p.year}-${p.month}-${p.day}`;
  }
}

export function formatTime(date: Date, settings: Pick<DisplaySettings, "timezone" | "timeFormat" | "locale">): string {
  const { timezone, timeFormat, locale } = settings;
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: timeFormat === "12h",
  }).format(date);
}

export function formatDateTime(date: Date, settings: DisplaySettings): string {
  return `${formatDate(date, settings)} · ${formatTime(date, settings)}`;
}
