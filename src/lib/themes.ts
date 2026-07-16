export interface ThemeDef {
  id: string;
  label: string;
  swatch: string; // representative color for the switcher preview dot
}

export const THEMES: ThemeDef[] = [
  { id: "midnight", label: "Midnight", swatch: "#3b82f6" },
  { id: "light", label: "Light", swatch: "#2563eb" },
  { id: "ocean", label: "Ocean", swatch: "#38bdf8" },
  { id: "emerald", label: "Emerald", swatch: "#10b981" },
  { id: "slate", label: "Slate", swatch: "#6d84e6" },
  { id: "sunset", label: "Sunset", swatch: "#f59e0b" },
  { id: "nord", label: "Nord", swatch: "#88c0d0" },
  { id: "crimson", label: "Crimson", swatch: "#f43f5e" },
  { id: "violet", label: "Violet", swatch: "#8b5cf6" },
  { id: "forest", label: "Forest", swatch: "#6b9962" },
  { id: "rose-light", label: "Rose Light", swatch: "#e11d48" },
  { id: "amber-light", label: "Amber Light", swatch: "#d97706" },
  { id: "graphite", label: "Graphite", swatch: "#22d3ee" },
  { id: "solarized", label: "Solarized", swatch: "#2aa198" },
  { id: "cyberpunk", label: "Cyberpunk", swatch: "#ff00ea" },
];

export const DEFAULT_THEME = "midnight";
export const THEME_STORAGE_KEY = "logmonitor-theme";

export function isValidTheme(id: string | null): id is string {
  return !!id && THEMES.some((t) => t.id === id);
}

// Inlined verbatim into a <script> tag in the root layout so it runs synchronously before
// first paint — reading this as a function and calling .toString() would work too, but a
// plain string keeps the exact executed code visible/auditable in one place.
//
// The root layout now sets the correct data-theme directly from a server-read cookie (see
// src/app/layout.tsx), so this only still matters for a theme saved back when this was
// localStorage-only: if the server didn't already apply one (no cookie yet), fall back to
// whatever's in localStorage and migrate it into a cookie so every load after this one comes
// straight from the server instead of needing this script at all.
export const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    if (document.documentElement.getAttribute('data-theme')) return;
    var t = localStorage.getItem('${THEME_STORAGE_KEY}');
    var valid = ${JSON.stringify(THEMES.map((t) => t.id))};
    if (t && valid.indexOf(t) !== -1) {
      document.documentElement.setAttribute('data-theme', t);
      document.cookie = '${THEME_STORAGE_KEY}=' + t + '; path=/; max-age=31536000; SameSite=Lax';
    }
  } catch (e) {}
})();
`;
