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
];

export const DEFAULT_THEME = "midnight";
export const THEME_STORAGE_KEY = "logmonitor-theme";

export function isValidTheme(id: string | null): id is string {
  return !!id && THEMES.some((t) => t.id === id);
}

// Inlined verbatim into a <script> tag in the root layout so it runs synchronously before
// first paint — reading this as a function and calling .toString() would work too, but a
// plain string keeps the exact executed code visible/auditable in one place.
export const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('${THEME_STORAGE_KEY}');
    var valid = ${JSON.stringify(THEMES.map((t) => t.id))};
    if (t && valid.indexOf(t) !== -1) {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {}
})();
`;
