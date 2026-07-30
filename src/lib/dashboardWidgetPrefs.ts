// Per-browser dashboard widget customization (show/hide + reorder), persisted the same way as
// the existing sidebar reorder feature (src/lib/navOrder.ts's "logmonitor-sidebar-order") -
// localStorage, no DB table, since this is a personal UI arrangement rather than data other
// admins need to see.
export const DASHBOARD_WIDGET_PREFS_KEY = "logmonitor-dashboard-widgets";

export interface DashboardWidgetPrefs {
  order: string[]; // widget ids, custom order
  disabled: string[]; // widget ids the user turned off
}

export function loadDashboardWidgetPrefs(): DashboardWidgetPrefs {
  try {
    const raw = localStorage.getItem(DASHBOARD_WIDGET_PREFS_KEY);
    if (!raw) return { order: [], disabled: [] };
    const parsed = JSON.parse(raw);
    return {
      order: Array.isArray(parsed.order) ? parsed.order : [],
      disabled: Array.isArray(parsed.disabled) ? parsed.disabled : [],
    };
  } catch {
    return { order: [], disabled: [] };
  }
}

export function saveDashboardWidgetPrefs(prefs: DashboardWidgetPrefs): void {
  localStorage.setItem(DASHBOARD_WIDGET_PREFS_KEY, JSON.stringify(prefs));
}
