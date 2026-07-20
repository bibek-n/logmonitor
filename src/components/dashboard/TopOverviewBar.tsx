"use client";

import { useEffect, useState } from "react";
import { Droplets, Wind, CloudSun } from "lucide-react";
import { Card } from "@/components/ui/Card";
import AnalogClock from "@/components/AnalogClock";
import { WorldClocksCard } from "./WorldClocksCard";
import { NepalWeatherCard } from "./NepalWeatherCard";
import { FlagIcon } from "./FlagIcon";
import type { WeatherSummary } from "@/lib/weather";

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function WeatherDetail({ weather }: { weather: WeatherSummary }) {
  return (
    <div className="flex items-center gap-4 flex-wrap" style={{ flex: 1 }}>
      <div style={{ fontSize: "2rem" }}>{weather.icon}</div>
      <div>
        <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1.1 }}>
          {Math.round(weather.tempC)}°C <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--ink-muted)" }}>{weather.label}</span>
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
          {weather.locationLabel} · Feels like {Math.round(weather.feelsLikeC)}°C
        </div>
      </div>
      <div className="flex items-center gap-1" style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
        <Droplets size={13} /> {Math.round(weather.humidityPct)}%
      </div>
      <div className="flex items-center gap-1" style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
        <Wind size={13} /> {Math.round(weather.windKph)} km/h
      </div>
      {weather.daily.slice(1, 4).map((d) => (
        <div key={d.date} style={{ textAlign: "center", fontSize: "0.72rem", color: "var(--ink-muted)" }}>
          <div>{new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}</div>
          <div style={{ fontSize: "1rem" }}>{d.icon}</div>
          <div style={{ color: "var(--ink)" }}>
            {Math.round(d.tempMaxC)}° / {Math.round(d.tempMinC)}°
          </div>
        </div>
      ))}
    </div>
  );
}

export function TopOverviewBar({
  weather,
  nepalCitiesWeather = [],
  swedenWeather = null,
}: {
  weather: WeatherSummary | null;
  nepalCitiesWeather?: WeatherSummary[];
  swedenWeather?: WeatherSummary | null;
}) {
  const now = useClock();

  return (
    <Card>
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          {now && <AnalogClock date={now} size={64} />}
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--ink)" }}>
              {now ? now.toLocaleTimeString() : "--:--:--"}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
              {now ? now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : ""}
            </div>
          </div>
        </div>

        <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />

        {weather ? <WeatherDetail weather={weather} /> : (
          <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Weather unavailable right now.</div>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", margin: "1rem 0" }} />
      <WorldClocksCard embedded swedenWeather={swedenWeather} />

      <div style={{ borderTop: "1px solid var(--border)", margin: "1rem 0" }} />
      <NepalWeatherCard cities={nepalCitiesWeather} embedded />

      <div style={{ borderTop: "1px solid var(--border)", margin: "1rem 0" }} />
      <div className="flex items-center gap-2" style={{ marginBottom: "0.75rem" }}>
        <CloudSun size={16} style={{ color: "var(--ink-muted)" }} />
        <FlagIcon code="se" label="Sweden" size={15} />
        <h2 style={{ fontSize: "0.9rem", margin: 0, color: "var(--ink)" }}>Sweden Climate</h2>
      </div>
      {swedenWeather ? (
        <WeatherDetail weather={swedenWeather} />
      ) : (
        <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Weather unavailable right now.</p>
      )}
    </Card>
  );
}
