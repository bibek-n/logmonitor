"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Bookmark, Plus } from "lucide-react";
import { loadSavedViews, addSavedView, removeSavedView, type SavedView } from "@/lib/savedViews";

// Drop onto any list page whose filters live in the URL query string (e.g. Staff's
// type/status tiles) to let the viewer save the current filter combination under a name and
// jump back to it later with one click. Pure client-side/localStorage - same personal,
// per-browser convenience as the dashboard widget and sidebar-order prefs, nothing to persist
// server-side. Only works for pages where filters are reflected in the address bar; a page
// whose filters live only in client component state needs to sync to the URL first.
export function SavedViews({ pageKey, basePath }: { pageKey: string; basePath: string }) {
  const router = useRouter();
  const [views, setViews] = useState<SavedView[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setViews(loadSavedViews(pageKey));
  }, [pageKey]);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const query = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    setViews(addSavedView(pageKey, { name: trimmed, query }));
    setName("");
    setAdding(false);
  }

  function handleDelete(viewName: string, e: React.MouseEvent) {
    e.stopPropagation();
    setViews(removeSavedView(pageKey, viewName));
  }

  return (
    <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: "0.78rem" }}>
      {views.map((v) => (
        <button
          key={v.name}
          onClick={() => router.push(v.query ? `${basePath}?${v.query}` : basePath)}
          className="flex items-center gap-1"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "0.25rem 0.5rem 0.25rem 0.6rem",
            background: "var(--surface-2)",
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          <Bookmark size={11} style={{ color: "var(--ink-muted)" }} />
          {v.name}
          <span onClick={(e) => handleDelete(v.name, e)} style={{ display: "inline-flex", marginLeft: "0.15rem", color: "var(--ink-muted)" }}>
            <X size={11} />
          </span>
        </button>
      ))}
      {adding ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="View name"
            style={{ fontSize: "0.78rem", padding: "0.25rem 0.5rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", width: 120 }}
          />
          <button onClick={handleSave} style={{ border: "none", background: "none", color: "var(--series-1)", cursor: "pointer", fontSize: "0.78rem" }}>
            Save
          </button>
        </span>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1"
          style={{ border: "1px dashed var(--border)", borderRadius: 999, padding: "0.25rem 0.5rem", background: "none", color: "var(--ink-muted)", cursor: "pointer" }}
        >
          <Plus size={11} />
          Save current view
        </button>
      )}
    </div>
  );
}
