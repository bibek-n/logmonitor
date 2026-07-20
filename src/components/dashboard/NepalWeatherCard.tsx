import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FlagIcon } from "./FlagIcon";
import type { WeatherSummary } from "@/lib/weather";

export function NepalWeatherCard({ cities, embedded = false }: { cities: WeatherSummary[]; embedded?: boolean }) {
  const content = (
    <>
      <div className="flex items-center gap-2" style={{ marginBottom: "0.75rem" }}>
        <MapPin size={16} style={{ color: "var(--ink-muted)" }} />
        <FlagIcon code="np" label="Nepal" size={15} />
        <h2 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Weather Across Nepal</h2>
      </div>

      {cities.length === 0 ? (
        <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Weather unavailable right now.</p>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          {cities.map((c) => (
            <div
              key={c.locationLabel}
              className="flex items-center gap-3"
              style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem 0.75rem" }}
            >
              <div style={{ fontSize: "1.6rem" }}>{c.icon}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)" }}>{c.locationLabel}</div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>
                  {Math.round(c.tempC)}°C
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}>{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (embedded) return content;
  return <Card>{content}</Card>;
}
