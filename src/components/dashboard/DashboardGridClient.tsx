"use client";

import { ReactNode, CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Settings2, Save, RotateCcw, Eye, EyeOff, Plus, Trash2, Check } from "lucide-react";
import { WIDGET_CATALOG, RESTRICTED_DEFAULT_WIDGET_IDS, getCatalogEntry } from "@/lib/dashboardLayouts/catalog";
import { getModuleAccentColor } from "@/lib/dashboardLayouts/widgetColors";
import {
  WIDGET_SIZE_SPAN,
  WIDGET_SIZE_LABEL,
  REFRESH_INTERVAL_OPTIONS,
  type WidgetSize,
  type LayoutWidgetState,
  type DashboardLayoutFull,
  type DashboardLayoutSummary,
} from "@/lib/dashboardLayouts/types";
import { ManageWidgetsDialog } from "./ManageWidgetsDialog";
import { AutoRefresh } from "./AutoRefresh";

function defaultWidgetState(isAdmin: boolean): LayoutWidgetState[] {
  return WIDGET_CATALOG.map((w) => ({
    id: w.id,
    size: w.defaultSize,
    enabled: isAdmin || RESTRICTED_DEFAULT_WIDGET_IDS.includes(w.id),
  }));
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  return res.json();
}

function SortableWidget({
  id,
  size,
  editMode,
  onSizeChange,
  onToggle,
  children,
}: {
  id: string;
  size: WidgetSize;
  editMode: boolean;
  onSizeChange: (size: WidgetSize) => void;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const entry = getCatalogEntry(id);
  const accentColor = entry ? getModuleAccentColor(entry.module) : undefined;

  return (
    <div
      ref={setNodeRef}
      style={
        {
          gridColumn: `span ${WIDGET_SIZE_SPAN[size]}`,
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
          position: "relative",
          ...(accentColor ? { "--widget-accent-color": accentColor } : {}),
        } as CSSProperties
      }
      className="h-full"
    >
      {editMode && (
        <div
          className="flex items-center justify-between"
          style={{
            marginBottom: 6,
            padding: "0.3rem 0.5rem",
            borderRadius: 8,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <button type="button" {...attributes} {...listeners} style={{ cursor: "grab", display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--ink-muted)" }}>
            <GripVertical size={14} />
            <span style={{ fontSize: "0.72rem" }}>{entry?.label ?? id}</span>
          </button>
          <div className="flex items-center gap-1">
            {(["small", "medium", "large", "full"] as WidgetSize[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSizeChange(s)}
                title={WIDGET_SIZE_LABEL[s]}
                style={{
                  fontSize: "0.65rem",
                  padding: "0.15rem 0.4rem",
                  borderRadius: 5,
                  border: "1px solid var(--border)",
                  background: s === size ? "var(--primary)" : "transparent",
                  color: s === size ? "#fff" : "var(--ink-muted)",
                  cursor: "pointer",
                }}
              >
                {WIDGET_SIZE_LABEL[s][0]}
              </button>
            ))}
            <button type="button" onClick={onToggle} title="Hide widget" style={{ background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", padding: "0 0 0 4px" }}>
              <EyeOff size={14} />
            </button>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

export function DashboardGridClient({
  initialLayout,
  widgetNodes,
  isAdmin = true,
}: {
  initialLayout: DashboardLayoutFull | null;
  widgetNodes: Record<string, ReactNode>;
  isAdmin?: boolean;
}) {
  const [widgets, setWidgets] = useState<LayoutWidgetState[]>(initialLayout?.content.widgets ?? defaultWidgetState(isAdmin));
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(initialLayout?.refreshIntervalSeconds ?? 900);
  const [activeLayoutId, setActiveLayoutId] = useState<number | null>(initialLayout?.id ?? null);
  const [layouts, setLayouts] = useState<DashboardLayoutSummary[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [savingAsName, setSavingAsName] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const skipNextSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    jsonFetch<{ ok: boolean; layouts: DashboardLayoutSummary[] }>("/api/admin/dashboard-layouts").then((res) => {
      if (res.ok) setLayouts(res.layouts);
    });
  }, []);

  const persist = useCallback(
    async (nextWidgets: LayoutWidgetState[], nextInterval: number) => {
      setSaveStatus("saving");
      const content = { widgets: nextWidgets };
      if (activeLayoutId) {
        await jsonFetch(`/api/admin/dashboard-layouts/${activeLayoutId}`, {
          method: "PATCH",
          body: JSON.stringify({ content, refreshIntervalSeconds: nextInterval }),
        });
      } else {
        const res = await jsonFetch<{ ok: boolean; id: number }>("/api/admin/dashboard-layouts", {
          method: "POST",
          body: JSON.stringify({ name: "Default", content, refreshIntervalSeconds: nextInterval, activate: true }),
        });
        if (res.ok) {
          setActiveLayoutId(res.id);
          setLayouts((prev) => [...prev, { id: res.id, name: "Default", isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
        }
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    },
    [activeLayoutId]
  );

  // Debounced auto-save whenever the arrangement changes - skips the very first render (that's
  // just loading whatever was already saved, not a change to persist).
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(widgets, refreshIntervalSeconds), 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgets, refreshIntervalSeconds]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWidgets((prev) => {
      const oldIndex = prev.findIndex((w) => w.id === active.id);
      const newIndex = prev.findIndex((w) => w.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function updateWidgetSize(id: string, size: WidgetSize) {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, size } : w)));
  }

  function toggleWidget(id: string) {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)));
  }

  function resetToDefault() {
    setWidgets(defaultWidgetState(isAdmin));
  }

  async function switchLayout(id: number) {
    const res = await jsonFetch<{ ok: boolean; layout: DashboardLayoutFull }>(`/api/admin/dashboard-layouts/${id}`);
    if (!res.ok) return;
    await jsonFetch(`/api/admin/dashboard-layouts/${id}`, { method: "PATCH", body: JSON.stringify({ activate: true }) });
    skipNextSave.current = true;
    setActiveLayoutId(id);
    setWidgets(res.layout.content.widgets);
    setRefreshIntervalSeconds(res.layout.refreshIntervalSeconds);
    setLayouts((prev) => prev.map((l) => ({ ...l, isActive: l.id === id })));
  }

  async function saveAsNewLayout() {
    const name = savingAsName?.trim();
    if (!name) return;
    const res = await jsonFetch<{ ok: boolean; id: number }>("/api/admin/dashboard-layouts", {
      method: "POST",
      body: JSON.stringify({ name, content: { widgets }, refreshIntervalSeconds, activate: true }),
    });
    if (res.ok) {
      skipNextSave.current = true;
      setActiveLayoutId(res.id);
      setLayouts((prev) => [...prev.map((l) => ({ ...l, isActive: false })), { id: res.id, name, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
    }
    setSavingAsName(null);
  }

  async function deleteLayout(id: number) {
    await jsonFetch(`/api/admin/dashboard-layouts/${id}`, { method: "DELETE" });
    setLayouts((prev) => prev.filter((l) => l.id !== id));
    if (activeLayoutId === id) {
      skipNextSave.current = true;
      setActiveLayoutId(null);
      setWidgets(defaultWidgetState(isAdmin));
    }
  }

  const visibleWidgets = useMemo(() => widgets.filter((w) => w.enabled && widgetNodes[w.id]), [widgets, widgetNodes]);

  return (
    <div>
      <AutoRefresh intervalMs={refreshIntervalSeconds * 1000} />

      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: "0.9rem" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activeLayoutId ?? ""}
            onChange={(e) => (e.target.value ? switchLayout(Number(e.target.value)) : undefined)}
            style={selectStyle}
          >
            <option value="">Default (unsaved)</option>
            {layouts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          {savingAsName === null ? (
            <button type="button" onClick={() => setSavingAsName("")} style={toolbarBtnStyle}>
              <Plus size={13} /> Save as New Layout
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={savingAsName}
                onChange={(e) => setSavingAsName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveAsNewLayout()}
                placeholder="Layout name"
                style={{ ...selectStyle, width: 140 }}
              />
              <button type="button" onClick={saveAsNewLayout} style={toolbarBtnStyle}>
                <Save size={13} />
              </button>
            </div>
          )}

          {activeLayoutId && (
            <button type="button" onClick={() => deleteLayout(activeLayoutId)} style={toolbarBtnStyle} title="Delete this layout">
              <Trash2 size={13} />
            </button>
          )}

          <button type="button" onClick={resetToDefault} style={toolbarBtnStyle}>
            <RotateCcw size={13} /> Reset to Default
          </button>

          <select value={refreshIntervalSeconds} onChange={(e) => setRefreshIntervalSeconds(Number(e.target.value))} style={selectStyle}>
            {REFRESH_INTERVAL_OPTIONS.map((o) => (
              <option key={o.seconds} value={o.seconds}>
                Refresh: {o.label}
              </option>
            ))}
          </select>

          <span style={{ fontSize: "0.72rem", color: "var(--ink-muted)", minWidth: 50 }}>
            {saveStatus === "saving" && "Saving..."}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1">
                <Check size={12} /> Saved
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setEditMode((v) => !v)} style={{ ...toolbarBtnStyle, background: editMode ? "color-mix(in srgb, var(--primary) 16%, transparent)" : "var(--surface-2)", color: editMode ? "var(--primary)" : "var(--ink-muted)" }}>
            {editMode ? <Eye size={13} /> : <GripVertical size={13} />}
            {editMode ? "Done Arranging" : "Arrange Widgets"}
          </button>
          <button type="button" onClick={() => setManageOpen(true)} style={toolbarBtnStyle}>
            <Settings2 size={13} /> Manage Widgets
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleWidgets.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="grid" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 16, alignItems: "stretch" }}>
            {visibleWidgets.map((w) => (
              <SortableWidget key={w.id} id={w.id} size={w.size} editMode={editMode} onSizeChange={(size) => updateWidgetSize(w.id, size)} onToggle={() => toggleWidget(w.id)}>
                {widgetNodes[w.id]}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {manageOpen && (
        <ManageWidgetsDialog
          widgets={widgets}
          availableIds={new Set(Object.keys(widgetNodes))}
          onToggle={toggleWidget}
          onSizeChange={updateWidgetSize}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  );
}

const toolbarBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.4rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink-muted)",
  cursor: "pointer",
  fontSize: "0.78rem",
};

const selectStyle: React.CSSProperties = {
  padding: "0.4rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.78rem",
};
