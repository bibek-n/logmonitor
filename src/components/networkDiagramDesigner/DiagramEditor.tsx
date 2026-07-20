"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "@/components/networkDiagram/networkDiagram.css";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useDesignerStore } from "@/lib/networkDiagramDesigner/store";
import type { NetworkDiagramData, NetworkDiagramDesignStatus } from "@/lib/networkDiagramDesigner/types";
import { DiagramCanvas } from "./DiagramCanvas";
import { DeviceLibrary } from "./DeviceLibrary";
import { PropertiesPanel } from "./PropertiesPanel";
import { DiagramToolbar, CANVAS_DOM_ID } from "./DiagramToolbar";
import { DiagramErrorBoundary } from "./DiagramErrorBoundary";

export interface DiagramEditorInitial {
  id: number;
  name: string;
  description: string | null;
  status: NetworkDiagramDesignStatus;
  diagramData: NetworkDiagramData;
}

interface DiagramEditorProps {
  mode: "new" | "edit" | "view";
  initial?: DiagramEditorInitial;
}

export function DiagramEditor({ mode, initial }: DiagramEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);
  const initialized = useRef(false);

  const meta = useDesignerStore((s) => s.meta);
  const dirty = useDesignerStore((s) => s.dirty);
  const loadDiagram = useDesignerStore((s) => s.loadDiagram);
  const resetToEmpty = useDesignerStore((s) => s.resetToEmpty);
  const markSaved = useDesignerStore((s) => s.markSaved);
  const setStatus = useDesignerStore((s) => s.setStatus);
  const toDiagramData = useDesignerStore((s) => s.toDiagramData);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (mode === "new") {
      resetToEmpty();
    } else if (initial) {
      loadDiagram(
        initial.diagramData,
        { id: initial.id, name: initial.name, description: initial.description ?? "", status: initial.status },
        mode === "view"
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initial?.id]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function guardedNavigate(action: () => void) {
    if (dirty) {
      setPendingNav(() => action);
    } else {
      action();
    }
  }

  function handleBack() {
    guardedNavigate(() => router.push("/dashboard/network-diagram/designs"));
  }

  async function handleSave(status: "Draft" | "Published") {
    const name = meta.name.trim();
    if (status === "Published" && !name) {
      toast.show({ type: "error", message: "Please enter a diagram name before saving." });
      return;
    }
    const effectiveName = name || "Untitled Draft";
    setStatus(status);
    setSaving(true);
    try {
      const diagramData = toDiagramData();
      const body = { name: effectiveName, description: meta.description || null, status, diagramData };

      if (meta.id) {
        const res = await fetch(`/api/admin/network-diagram-designs/${meta.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to save diagram");
        markSaved(meta.id);
        toast.show({ type: "success", message: "Diagram saved." });
      } else {
        const res = await fetch("/api/admin/network-diagram-designs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to create diagram");
        markSaved(json.data.Id);
        toast.show({ type: "success", message: "Diagram created." });
        router.replace(`/dashboard/network-diagram/designs/${json.data.Id}/edit`);
      }
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save diagram" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ReactFlowProvider>
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <DiagramToolbar onSave={handleSave} onBack={handleBack} saving={saving} />
        <div id={CANVAS_DOM_ID} style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <DiagramErrorBoundary>
            <DeviceLibrary />
            <div style={{ flex: 1, position: "relative" }}>
              <DiagramCanvas />
            </div>
            <PropertiesPanel />
          </DiagramErrorBoundary>
        </div>
      </div>

      <ConfirmDialog
        open={pendingNav !== null}
        onClose={() => setPendingNav(null)}
        onConfirm={() => {
          const action = pendingNav;
          setPendingNav(null);
          action?.();
        }}
        title="Discard unsaved changes?"
        message="You have unsaved changes to this diagram. Leaving now will discard them."
        confirmLabel="Discard changes"
        tone="danger"
      />
    </ReactFlowProvider>
  );
}
