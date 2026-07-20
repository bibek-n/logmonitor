"use client";

import { useEffect, useState } from "react";
import { Folder, ArrowUp } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface FolderEntry {
  name: string;
  path: string;
}
interface FolderListing {
  currentPath: string | null;
  parentPath: string | null;
  entries: FolderEntry[];
}

// Shared by every module's Add/Edit Project "Local Path" field - each module points this at
// its own browse-folders route (e.g. /api/admin/code-quality/browse-folders,
// /api/admin/laravel-security/browse-folders) via `apiPath`, since the permission each route
// requires is module-specific even though the underlying folderBrowser.ts logic is shared.
export function FolderBrowseModal({ open, onClose, onSelect, apiPath }: { open: boolean; onClose: () => void; onSelect: (path: string) => void; apiPath: string }) {
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load(path: string | null) {
    setLoading(true);
    setError(null);
    const qs = path ? `?path=${encodeURIComponent(path)}` : "";
    fetch(`${apiPath}${qs}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setError(data.error ?? "Failed to browse folder.");
          return;
        }
        setListing(data.data);
      })
      .catch(() => setError("Failed to browse folder."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (open) load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Browse Server Folders"
      size="md"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            disabled={!listing?.currentPath}
            onClick={() => {
              if (listing?.currentPath) onSelect(listing.currentPath);
            }}
          >
            Select This Folder
          </Button>
        </>
      }
    >
      <div className="flex flex-col" style={{ gap: "0.6rem" }}>
        <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", fontFamily: "monospace", wordBreak: "break-all" }}>
          {listing?.currentPath ?? "Select an approved scan root to begin browsing"}
        </div>

        {error && (
          <div style={{ padding: "0.5rem 0.7rem", borderRadius: 8, background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)", fontSize: "0.8rem" }}>
            {error}
          </div>
        )}

        <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
          {loading ? (
            <div style={{ padding: "0.7rem", fontSize: "0.82rem", color: "var(--ink-muted)" }}>Loading…</div>
          ) : (
            <>
              {listing && listing.currentPath !== null && (
                <button
                  type="button"
                  onClick={() => load(listing!.parentPath)}
                  className="flex items-center gap-2 w-full"
                  style={{ padding: "0.5rem 0.7rem", background: "transparent", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "left", fontSize: "0.82rem", color: "var(--ink)" }}
                >
                  <ArrowUp size={14} /> ..
                </button>
              )}
              {listing?.entries.length === 0 ? (
                <div style={{ padding: "0.7rem", fontSize: "0.82rem", color: "var(--ink-muted)" }}>No subfolders here.</div>
              ) : (
                listing?.entries.map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() => load(entry.path)}
                    className="flex items-center gap-2 w-full"
                    style={{ padding: "0.5rem 0.7rem", background: "transparent", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "left", fontSize: "0.82rem", color: "var(--ink)" }}
                  >
                    <Folder size={14} /> {entry.name}
                  </button>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
