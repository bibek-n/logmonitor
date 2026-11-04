"use client";

import { useEffect, useRef, useState } from "react";
import { StickyNote, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function NotesCard() {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    fetch("/api/admin/dashboard-notes")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setContent(data.content);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setStatus("saving");
    saveTimer.current = setTimeout(async () => {
      await fetch("/api/admin/dashboard-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1200);
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, loaded]);

  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between" style={{ marginBottom: "0.6rem" }}>
        <div className="flex items-center gap-2">
          <StickyNote size={17} style={{ color: "var(--primary)" }} />
          <h2 style={{ fontSize: "1.125rem", margin: 0, color: "var(--ink)" }}>Notes</h2>
        </div>
        <span style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
          {status === "saving" && "Saving..."}
          {status === "saved" && (
            <span className="flex items-center gap-1">
              <Check size={12} /> Saved
            </span>
          )}
        </span>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Jot down anything you want to remember - only you can see this."
        style={{
          flex: 1,
          minHeight: 120,
          resize: "vertical",
          padding: "0.6rem",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--ink)",
          fontSize: "0.85rem",
          fontFamily: "inherit",
        }}
      />
    </Card>
  );
}
