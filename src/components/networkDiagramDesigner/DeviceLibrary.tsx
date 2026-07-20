"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DEVICE_LIBRARY, DEVICE_CATEGORY_LABELS, DEVICE_CATEGORY_ORDER } from "@/lib/networkDiagramDesigner/deviceLibrary";
import { useDesignerStore } from "@/lib/networkDiagramDesigner/store";
import { DEVICE_DRAG_MIME } from "./DiagramCanvas";

export function DeviceLibrary() {
  const [query, setQuery] = useState("");
  const readOnly = useDesignerStore((s) => s.readOnly);
  const addDevice = useDesignerStore((s) => s.addDevice);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? DEVICE_LIBRARY.filter((d) => d.label.toLowerCase().includes(q)) : DEVICE_LIBRARY;
    return DEVICE_CATEGORY_ORDER.map((category) => ({
      category,
      items: filtered.filter((d) => d.category === category),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  if (readOnly) return null;

  return (
    <div
      style={{
        width: 240, flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: "1px solid var(--border)", background: "var(--surface)",
        height: "100%", overflow: "hidden",
      }}
    >
      <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search devices..."
            style={{
              width: "100%", padding: "0.4rem 0.5rem 0.4rem 1.8rem", borderRadius: 8,
              border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.8rem",
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0.75rem" }}>
        {grouped.map(({ category, items }) => (
          <div key={category} style={{ marginBottom: "0.9rem" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-muted)", marginBottom: "0.4rem" }}>
              {DEVICE_CATEGORY_LABELS[category]}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DEVICE_DRAG_MIME, item.type);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDoubleClick={() => addDevice(item.type, { x: 120 + Math.random() * 200, y: 120 + Math.random() * 200 })}
                    title={`Drag onto canvas, or double-click to add ${item.label}`}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                      padding: "0.5rem 0.25rem", borderRadius: 8, border: "1px solid var(--border)",
                      background: "var(--surface-2)", cursor: "grab", userSelect: "none",
                    }}
                  >
                    <Icon size={18} style={{ color: "var(--primary)" }} />
                    <span style={{ fontSize: "0.65rem", color: "var(--ink)", textAlign: "center", lineHeight: 1.2 }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", textAlign: "center", marginTop: "1rem" }}>No devices match &quot;{query}&quot;</p>
        )}
      </div>
    </div>
  );
}
