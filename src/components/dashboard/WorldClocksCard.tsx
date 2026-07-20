"use client";

import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import AnalogClock from "@/components/AnalogClock";
import { FlagIcon } from "./FlagIcon";
import type { WeatherSummary } from "@/lib/weather";

const WORLD_CLOCKS = [
  { label: "India", tz: "Asia/Kolkata", flagCode: "in" },
  { label: "Sweden", tz: "Europe/Stockholm", flagCode: "se" },
  { label: "USA (New York)", tz: "America/New_York", flagCode: "us" },
];

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Parses the target zone's wall-clock string back into a Date whose LOCAL fields (as read
// by the browser's own zone, which is what AnalogClock/toLocaleTimeString read) match that
// wall clock — a standard trick for rendering another timezone's time without extra deps.
function zonedDate(date: Date, timeZone: string): Date {
  return new Date(date.toLocaleString("en-US", { timeZone }));
}

export function WorldClocksCard({
  embedded = false,
  swedenWeather = null,
}: {
  embedded?: boolean;
  swedenWeather?: WeatherSummary | null;
}) {
  const now = useClock();

  const content = (
    <>
      <div className="flex items-center gap-2" style={{ marginBottom: "0.75rem" }}>
        <Globe2 size={16} style={{ color: "var(--ink-muted)" }} />
        <h2 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>World Clocks</h2>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {WORLD_CLOCKS.map((c) => {
          const zoned = now ? zonedDate(now, c.tz) : null;
          const weather = c.label === "Sweden" ? swedenWeather : null;
          return (
            <div
              key={c.tz}
              className="flex items-center gap-3"
              style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem 0.75rem" }}
            >
              {zoned ? <AnalogClock date={zoned} size={40} /> : <div style={{ width: 40, height: 40 }} />}
              <div style={{ minWidth: 0 }}>
                <div className="flex items-center gap-1.5" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)" }}>
                  <FlagIcon code={c.flagCode} label={c.label} size={14} /> {c.label}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>
                  {zoned
                    ? zoned.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                    : "--:--:--"}
                </div>
                {weather && (
                  <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: "0.15rem" }}>
                    {weather.icon} {Math.round(weather.tempC)}°C
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  if (embedded) return content;
  return <Card>{content}</Card>;
}
