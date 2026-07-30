"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface CandidateWebsite {
  Id: number;
  Name: string;
  Url: string;
  Environment: string;
}

export function ImportWebsitesModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const toast = useToast();
  const [candidates, setCandidates] = useState<CandidateWebsite[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCandidates(null);
    setSelected(new Set());
    fetch("/api/admin/monitoring/websites/import-candidates")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setCandidates(d.data);
        else toast.show({ type: "error", message: d.error ?? "Failed to load websites." });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function importSelected() {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/admin/monitoring/websites/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteIds: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Import failed.");
      const { created, skipped } = data.data as { created: unknown[]; skipped: unknown[] };
      toast.show({
        type: "success",
        message: `Added ${created.length} website monitor${created.length === 1 ? "" : "s"}.${skipped.length ? ` ${skipped.length} skipped (already monitored).` : ""}`,
      });
      onImported();
      onClose();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Import failed." });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add from Websites"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={importSelected} disabled={importing || selected.size === 0}>
            {importing ? "Adding..." : `Add Selected (${selected.size})`}
          </Button>
        </>
      }
    >
      <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem", marginTop: 0 }}>
        Pick which sites from your existing Websites list should get a website monitor. Nothing is added automatically — only the
        ones you check below.
      </p>

      {candidates === null ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : candidates.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>Every enabled site in your Websites list already has a monitor.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {candidates.map((c) => (
            <label
              key={c.Id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.5rem 0.6rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: selected.has(c.Id) ? "color-mix(in srgb, var(--sidebar-accent, var(--series-1)) 10%, transparent)" : "transparent",
                cursor: "pointer",
              }}
            >
              <input type="checkbox" checked={selected.has(c.Id)} onChange={() => toggle(c.Id)} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{c.Name}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.Url}
                </div>
              </div>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-muted)", flexShrink: 0 }}>{c.Environment}</span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}
