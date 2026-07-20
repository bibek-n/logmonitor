"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

export function TagsEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const value = draft.trim().slice(0, 50);
    if (value && !tags.includes(value)) onChange([...tags, value]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    }
  }

  return (
    <div
      className="flex items-center flex-wrap gap-1.5"
      style={{ padding: "0.4rem 0.5rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1"
          style={{ padding: "0.15rem 0.5rem", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.75rem" }}
        >
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", display: "flex" }}>
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commitDraft}
        placeholder="Add tag, press Enter"
        style={{ border: "none", outline: "none", background: "transparent", color: "var(--ink)", fontSize: "0.8rem", flex: 1, minWidth: 100 }}
      />
    </div>
  );
}
