import { getDb } from "./db";

// WMO weather-interpretation codes (used by Open-Meteo's `weather_code` field) mapped to a
// short human label + emoji, condensed from the table Open-Meteo documents.
const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear sky", icon: "☀️" },
  1: { label: "Mostly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Depositing rime fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Dense drizzle", icon: "🌦️" },
  56: { label: "Freezing drizzle", icon: "🌧️" },
  57: { label: "Dense freezing drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🌨️" },
  67: { label: "Heavy freezing rain", icon: "🌨️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "❄️" },
  75: { label: "Heavy snow", icon: "❄️" },
  77: { label: "Snow grains", icon: "❄️" },
  80: { label: "Light rain showers", icon: "🌦️" },
  81: { label: "Rain showers", icon: "🌧️" },
  82: { label: "Violent rain showers", icon: "⛈️" },
  85: { label: "Light snow showers", icon: "🌨️" },
  86: { label: "Heavy snow showers", icon: "🌨️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm with hail", icon: "⛈️" },
  99: { label: "Thunderstorm with heavy hail", icon: "⛈️" },
};

function describeCode(code: number): { label: string; icon: string } {
  return WMO_CODES[code] ?? { label: "Unknown", icon: "🌡️" };
}

interface Coordinates {
  latitude: number;
  longitude: number;
  locationLabel: string;
}

// Prefers the admin-configured company City/Country (Company Profile settings) geocoded via
// Open-Meteo's free keyless geocoding API; falls back to this server's own IP-based
// geolocation (same ip-api.com lookup the "What Is My IP" dashboard card already uses) when
// no company location is on file or the geocode comes back empty.
async function resolveCoordinates(): Promise<Coordinates> {
  const db = await getDb();
  const result = await db.query<{ City: string | null; Country: string | null }>`
    SELECT City, Country FROM CompanySettings WHERE Id = 1
  `;
  const company = result.recordset[0];

  if (company?.City) {
    const query = new URLSearchParams({ name: company.City, count: "1", language: "en", format: "json" });
    if (company.Country) query.set("country", company.Country);
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${query.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (geoRes.ok) {
      const geoData = (await geoRes.json()) as { results?: { latitude: number; longitude: number; name: string; country?: string }[] };
      const hit = geoData.results?.[0];
      if (hit) {
        return { latitude: hit.latitude, longitude: hit.longitude, locationLabel: [hit.name, hit.country].filter(Boolean).join(", ") };
      }
    }
  }

  // Fallback: this server's own public IP location.
  const ipRes = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8000) });
  if (!ipRes.ok) throw new Error(`Could not determine public IP (HTTP ${ipRes.status}).`);
  const { ip } = (await ipRes.json()) as { ip: string };
  const locRes = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,city,country,lat,lon`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!locRes.ok) throw new Error(`HTTP ${locRes.status}`);
  const locData = (await locRes.json()) as { status: string; message?: string; city?: string; country?: string; lat?: number; lon?: number };
  if (locData.status !== "success" || locData.lat == null || locData.lon == null) {
    throw new Error(locData.message || "Could not determine location for weather lookup.");
  }
  return { latitude: locData.lat, longitude: locData.lon, locationLabel: [locData.city, locData.country].filter(Boolean).join(", ") };
}

export interface DailyForecast {
  date: string;
  label: string;
  icon: string;
  tempMaxC: number;
  tempMinC: number;
}

export interface WeatherSummary {
  locationLabel: string;
  tempC: number;
  feelsLikeC: number;
  humidityPct: number;
  windKph: number;
  label: string;
  icon: string;
  daily: DailyForecast[];
}

// The dashboard homepage re-runs on every request (force-dynamic, no page-level caching),
// but weather doesn't change second-to-second — an in-memory TTL cache avoids hitting
// Open-Meteo (and the company-location geocode/IP-geolocation fallback) on every single
// page view. Same pattern as trafficByCountry.ts's cache.
const CACHE_TTL_MS = 5 * 60 * 1000;
let weatherCache: { result: WeatherSummary; fetchedAt: number } | null = null;
let nepalCitiesCache: { result: WeatherSummary[]; fetchedAt: number } | null = null;
let swedenCache: { result: WeatherSummary; fetchedAt: number } | null = null;

// Open-Meteo requires no API key and has no rate limit for this volume of use — well suited
// to a dashboard widget refreshed on page load rather than a paid weather provider.
export async function getWeatherSummary(): Promise<WeatherSummary> {
  if (weatherCache && Date.now() - weatherCache.fetchedAt < CACHE_TTL_MS) return weatherCache.result;
  const { latitude, longitude, locationLabel } = await resolveCoordinates();
  const result = await fetchWeatherForCoordinates(latitude, longitude, locationLabel);
  weatherCache = { result, fetchedAt: Date.now() };
  return result;
}

async function fetchWeatherForCoordinates(latitude: number, longitude: number, locationLabel: string): Promise<WeatherSummary> {
  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,weather_code",
    timezone: "auto",
    forecast_days: "4",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Weather lookup failed (HTTP ${res.status}).`);
  const data = (await res.json()) as {
    current?: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; weather_code: number; wind_speed_10m: number };
    daily?: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[] };
  };
  if (!data.current || !data.daily) throw new Error("Weather provider returned an unexpected response.");

  const current = describeCode(data.current.weather_code);
  const daily: DailyForecast[] = data.daily.time.map((date, i) => {
    const desc = describeCode(data.daily!.weather_code[i]);
    return { date, label: desc.label, icon: desc.icon, tempMaxC: data.daily!.temperature_2m_max[i], tempMinC: data.daily!.temperature_2m_min[i] };
  });

  return {
    locationLabel: locationLabel || "Unknown location",
    tempC: data.current.temperature_2m,
    feelsLikeC: data.current.apparent_temperature,
    humidityPct: data.current.relative_humidity_2m,
    windKph: data.current.wind_speed_10m,
    label: current.label,
    icon: current.icon,
    daily,
  };
}

// Fixed coordinates for a geographic spread of major Nepal cities (west/east/mid-west),
// deliberately distinct from the admin-configured company city shown in the main weather
// card, so this widget adds coverage rather than duplicating it.
const NEPAL_CITIES: { label: string; latitude: number; longitude: number }[] = [
  { label: "Pokhara", latitude: 28.2096, longitude: 83.9856 },
  { label: "Biratnagar", latitude: 26.4525, longitude: 87.2718 },
  { label: "Nepalgunj", latitude: 28.05, longitude: 81.6167 },
];

export async function getNepalCitiesWeather(): Promise<WeatherSummary[]> {
  if (nepalCitiesCache && Date.now() - nepalCitiesCache.fetchedAt < CACHE_TTL_MS) return nepalCitiesCache.result;
  const results = await Promise.all(
    NEPAL_CITIES.map(async (c) => {
      try {
        return await fetchWeatherForCoordinates(c.latitude, c.longitude, c.label);
      } catch {
        return null;
      }
    })
  );
  const result = results.filter((r): r is WeatherSummary => r !== null);
  nepalCitiesCache = { result, fetchedAt: Date.now() };
  return result;
}

// Stockholm represents Sweden, paired with the Sweden entry in the World Clocks widget.
export async function getSwedenWeather(): Promise<WeatherSummary> {
  if (swedenCache && Date.now() - swedenCache.fetchedAt < CACHE_TTL_MS) return swedenCache.result;
  const result = await fetchWeatherForCoordinates(59.3293, 18.0686, "Stockholm, Sweden");
  swedenCache = { result, fetchedAt: Date.now() };
  return result;
}
