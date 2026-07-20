"use client";

import { useState } from "react";
import Link from "next/link";
import { Waypoints, Plus, Pencil, Eye, Trash2, Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";

export interface DesignSummary {
  Id: number;
  Name: string;
  Description: string | null;
  Status: string;
  UpdatedAt: string;
}

interface LegacyDiagramSummary {
  name: string;
  updatedAt: string | null;
  hasContent: boolean;
}

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  Draft: "warning",
  Published: "success",
  Archived: "neutral",
};

function DesignsListInner({ legacy, designs }: { legacy: LegacyDiagramSummary; designs: DesignSummary[] }) {
  const router = useRouter();
  const toast = useToast();
  const [deleteTarget, setDeleteTarget] = useState<DesignSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [items, setItems] = useState(designs);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/network-diagram-designs/${deleteTarget.Id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to delete diagram");
      setItems((prev) => prev.filter((d) => d.Id !== deleteTarget.Id));
      toast.show({ type: "success", message: "Diagram deleted." });
      setDeleteTarget(null);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to delete diagram" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Network Diagrams</h1>
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
            Browse the existing topology diagram or design a new one from scratch.
          </p>
        </div>
        <Link href="/dashboard/network-diagram/designs/new">
          <Button variant="primary">
            <Plus size={16} /> Design New Diagram
          </Button>
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
        <Link href="/dashboard/network-diagram" style={{ textDecoration: "none" }}>
          <Card hoverLift style={{ height: "100%", display: "flex", flexDirection: "column", gap: "0.6rem", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Waypoints size={18} style={{ color: "var(--primary)" }} />
              <Badge tone="neutral">Existing Diagram</Badge>
            </div>
            <div style={{ fontWeight: 600, color: "var(--ink)" }}>{legacy.name}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
              {legacy.hasContent
                ? legacy.updatedAt
                  ? `Last updated ${new Date(legacy.updatedAt).toLocaleString()}`
                  : "The original topology diagram"
                : "Not yet populated"}
            </div>
          </Card>
        </Link>

        {items.map((d) => (
          <Card key={d.Id} hoverLift={false} style={{ height: "100%", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Badge tone={STATUS_TONE[d.Status] ?? "neutral"}>{d.Status}</Badge>
            </div>
            <div style={{ fontWeight: 600, color: "var(--ink)" }}>{d.Name}</div>
            {d.Description && (
              <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {d.Description}
              </div>
            )}
            <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
              Updated {new Date(d.UpdatedAt).toLocaleString()}
            </div>
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "auto" }}>
              <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/network-diagram/designs/${d.Id}/edit`)}>
                <Pencil size={13} /> Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => router.push(`/dashboard/network-diagram/designs/${d.Id}`)}>
                <Eye size={13} /> View
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(d)} style={{ marginLeft: "auto" }}>
                <Trash2 size={13} color="var(--danger)" />
              </Button>
            </div>
          </Card>
        ))}

        {items.length === 0 && (
          <Card hoverLift={false} style={{ gridColumn: "1 / -1", textAlign: "center", padding: "2rem", color: "var(--ink-muted)" }}>
            <Lock size={22} style={{ marginBottom: "0.5rem" }} />
            <p style={{ margin: 0, fontSize: "0.85rem" }}>No new designs yet — click &quot;Design New Diagram&quot; to create one.</p>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete diagram?"
        message={`"${deleteTarget?.Name}" will be removed from the list. This cannot be undone from here.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
      />
    </div>
  );
}

export function DesignsListClient(props: { legacy: LegacyDiagramSummary; designs: DesignSummary[] }) {
  return (
    <ToastProvider>
      <DesignsListInner {...props} />
    </ToastProvider>
  );
}
