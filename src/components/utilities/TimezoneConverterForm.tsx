"use client";

import { useMemo, useState } from "react";

const inputStyle = {
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.95rem",
};

const COMMON_ZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function formatInZone(date: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}

export default function TimezoneConverterForm() {
  const [sourceZone, setSourceZone] = useState<string>(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [localValue, setLocalValue] = useState<string>(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  });

  const { instant, error } = useMemo(() => {
    if (!localValue) return { instant: null as Date | null, error: "Pick a date and time." };
    try {
      // Interpret the naive datetime-local value as a wall-clock time in `sourceZone` by
      // computing that zone's current UTC offset and applying it - Date itself only knows the
      // browser's local zone, so this correction is required for any non-local source zone.
      const naiveUtc = new Date(localValue + "Z");
      const zoneOffsetMinutes = getZoneOffsetMinutes(naiveUtc, sourceZone);
      const instant = new Date(naiveUtc.getTime() - zoneOffsetMinutes * 60000);
      return { instant, error: null as string | null };
    } catch (err) {
      return { instant: null as Date | null, error: err instanceof Error ? err.message : "Invalid date/time." };
    }
  }, [localValue, sourceZone]);

  return (
    <div className="dash-panel">
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="datetime">Date &amp; Time</label>
          <input id="datetime" type="datetime-local" value={localValue} onChange={(e) => setLocalValue(e.target.value)} style={inputStyle} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="sourceZone">In Time Zone</label>
          <select id="sourceZone" value={sourceZone} onChange={(e) => setSourceZone(e.target.value)} style={inputStyle}>
            {COMMON_ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="error" style={{ marginTop: "1rem" }}>
          {error}
        </div>
      )}

      {instant && (
        <div style={{ marginTop: "1rem", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <tbody>
              {COMMON_ZONES.map((zone) => (
                <tr key={zone} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0.75rem 0.5rem 0", color: "var(--ink-muted)", whiteSpace: "nowrap" }}>{zone}</td>
                  <td style={{ padding: "0.5rem 0", fontFamily: "monospace" }}>{formatInZone(instant, zone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Computes `zone`'s offset from UTC (in minutes, UTC minus zone) at the instant `atUtc` by
// formatting that instant in `zone` and diffing against its UTC representation - the standard
// technique since Intl.DateTimeFormat has no direct "get UTC offset" API.
function getZoneOffsetMinutes(atUtc: Date, zone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(atUtc).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return (asUtc - atUtc.getTime()) / 60000;
}
