"use client";

import { ReactNode, useEffect, useState } from "react";
import { ArrowUpDown, Check, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { applyOrder, moveItem } from "@/lib/navOrder";
import { loadDashboardWidgetPrefs, saveDashboardWidgetPrefs, type DashboardWidgetPrefs } from "@/lib/dashboardWidgetPrefs";

export interface DashboardWidget {
  id: string;
  title: string;
  // Full-width widgets (bandwidth chart, alerts+timeline column) render as their own row;
  // everything else sits in the auto-fit card grid alongside other non-wide widgets.
  wide?: boolean;
  node: ReactNode;
}

// Mirrors the sidebar's own reorder feature (src/components/Sidebar.tsx) - a "Customize" toggle
// that reveals up/down arrows plus a show/hide eye per item, rather than drag-and-drop. Same
// interaction the user already knows from the sidebar, and avoids pulling in a drag-and-drop
// library for what up/down arrows already cover.
export function DashboardWidgetGrid({ widgets, customizeLabel, doneLabel }: { widgets: DashboardWidget[]; customizeLabel: string; doneLabel: string }) {
  const [prefs, setPrefs] = useState<DashboardWidgetPrefs>({ order: [], disabled: [] });
  const [customizeMode, setCustomizeMode] = useState(false);

  useEffect(() => {
    setPrefs(loadDashboardWidgetPrefs());
  }, []);

  function persist(next: DashboardWidgetPrefs) {
    setPrefs(next);
    saveDashboardWidgetPrefs(next);
  }

  const ordered = applyOrder(widgets, (w) => w.id, prefs.order);
  const enabledSet = new Set(widgets.map((w) => w.id).filter((id) => !prefs.disabled.includes(id)));

  function toggleWidget(id: string) {
    const disabled = prefs.disabled.includes(id) ? prefs.disabled.filter((d) => d !== id) : [...prefs.disabled, id];
    persist({ ...prefs, disabled });
  }

  function moveWidget(index: number, direction: "up" | "down") {
    const reordered = moveItem(ordered, index, direction);
    persist({ ...prefs, order: reordered.map((w) => w.id) });
  }

  const visible = ordered.filter((w) => enabledSet.has(w.id));

  return (
    <div>
      <div className="flex justify-end" style={{ marginBottom: "0.75rem" }}>
        <button
          type="button"
          onClick={() => setCustomizeMode((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.4rem 0.8rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: customizeMode ? "color-mix(in srgb, var(--primary) 16%, transparent)" : "var(--surface-2)",
            color: customizeMode ? "var(--primary)" : "var(--ink-muted)",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          {customizeMode ? <Check size={14} /> : <ArrowUpDown size={14} />}
          {customizeMode ? doneLabel : customizeLabel}
        </button>
      </div>

      {customizeMode && (
        <div className="dash-panel" style={{ marginBottom: "1rem" }}>
          <div className="flex flex-col gap-1">
            {ordered.map((w, index) => {
              const enabled = enabledSet.has(w.id);
              return (
                <div
                  key={w.id}
                  className="flex items-center justify-between"
                  style={{ padding: "0.45rem 0.6rem", borderRadius: 6, background: index % 2 === 0 ? "transparent" : "var(--surface-2)" }}
                >
                  <span style={{ fontSize: "0.85rem", color: enabled ? "var(--ink)" : "var(--ink-muted)" }}>{w.title}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => moveWidget(index, "up")} disabled={index === 0} style={arrowBtnStyle}>
                      <ChevronUp size={14} style={{ opacity: index === 0 ? 0.3 : 1 }} />
                    </button>
                    <button type="button" onClick={() => moveWidget(index, "down")} disabled={index === ordered.length - 1} style={arrowBtnStyle}>
                      <ChevronDown size={14} style={{ opacity: index === ordered.length - 1 ? 0.3 : 1 }} />
                    </button>
                    <button type="button" onClick={() => toggleWidget(w.id)} style={arrowBtnStyle} title={enabled ? "Hide" : "Show"}>
                      {enabled ? <Eye size={14} /> : <EyeOff size={14} style={{ opacity: 0.5 }} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {groupIntoRows(visible).map((row, i) =>
          row.length === 1 && row[0].wide ? (
            <div key={row[0].id}>{row[0].node}</div>
          ) : (
            <div key={i} className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
              {row.map((w) => (
                <div key={w.id}>{w.node}</div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// Consecutive non-wide widgets get grouped into the same grid row; a wide widget always breaks
// out onto its own full-width row.
function groupIntoRows(widgets: DashboardWidget[]): DashboardWidget[][] {
  const rows: DashboardWidget[][] = [];
  let current: DashboardWidget[] = [];
  for (const w of widgets) {
    if (w.wide) {
      if (current.length > 0) rows.push(current);
      rows.push([w]);
      current = [];
    } else {
      current.push(w);
    }
  }
  if (current.length > 0) rows.push(current);
  return rows;
}

const arrowBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--ink-muted)",
  cursor: "pointer",
  padding: 2,
  display: "flex",
};
