// Per-browser saved filter presets for a list page - same localStorage-only approach as
// dashboardWidgetPrefs.ts and the sidebar reorder feature (a personal UI convenience, not
// data other admins need to see). Keyed by pageKey so multiple pages can each have their own
// set of presets without colliding, under one shared top-level localStorage key.
const SAVED_VIEWS_KEY = "logmonitor-saved-views";

export interface SavedView {
  name: string;
  query: string; // the raw query string (no leading "?") this preset restores
}

type AllSavedViews = Record<string, SavedView[]>;

function loadAll(): AllSavedViews {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(all: AllSavedViews): void {
  localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(all));
}

export function loadSavedViews(pageKey: string): SavedView[] {
  return loadAll()[pageKey] ?? [];
}

export function addSavedView(pageKey: string, view: SavedView): SavedView[] {
  const all = loadAll();
  const existing = (all[pageKey] ?? []).filter((v) => v.name !== view.name);
  all[pageKey] = [...existing, view];
  saveAll(all);
  return all[pageKey];
}

export function removeSavedView(pageKey: string, name: string): SavedView[] {
  const all = loadAll();
  all[pageKey] = (all[pageKey] ?? []).filter((v) => v.name !== name);
  saveAll(all);
  return all[pageKey];
}
