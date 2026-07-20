"use client";

import { useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  Save, Undo2, Redo2, Copy, ClipboardPaste, Trash2, ZoomIn, ZoomOut, Maximize2,
  Grid3x3, Magnet, Download, Upload, Image as ImageIcon, FileText, Maximize, Minimize, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useDesignerStore } from "@/lib/networkDiagramDesigner/store";
import { networkDiagramDataSchema } from "@/lib/networkDiagramDesigner/schema";

const CANVAS_DOM_ID = "network-diagram-designer-canvas";

interface DiagramToolbarProps {
  onSave: (status: "Draft" | "Published") => void;
  onBack: () => void;
  saving: boolean;
}

export function DiagramToolbar({ onSave, onBack, saving }: DiagramToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const meta = useDesignerStore((s) => s.meta);
  const setName = useDesignerStore((s) => s.setName);
  const readOnly = useDesignerStore((s) => s.readOnly);
  const past = useDesignerStore((s) => s.past);
  const future = useDesignerStore((s) => s.future);
  const selectedNodeIds = useDesignerStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useDesignerStore((s) => s.selectedEdgeIds);
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const copySelection = useDesignerStore((s) => s.copySelection);
  const pasteClipboard = useDesignerStore((s) => s.pasteClipboard);
  const deleteSelected = useDesignerStore((s) => s.deleteSelected);
  const showGrid = useDesignerStore((s) => s.showGrid);
  const snapToGrid = useDesignerStore((s) => s.snapToGrid);
  const toggleShowGrid = useDesignerStore((s) => s.toggleShowGrid);
  const toggleSnapToGrid = useDesignerStore((s) => s.toggleSnapToGrid);
  const toDiagramData = useDesignerStore((s) => s.toDiagramData);
  const loadDiagram = useDesignerStore((s) => s.loadDiagram);

  const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0;

  function toggleFullscreen() {
    const el = document.getElementById(CANVAS_DOM_ID);
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }

  function exportJson() {
    const data = toDiagramData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meta.name || "network-diagram"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const parsed = networkDiagramDataSchema.safeParse(raw);
        if (!parsed.success) {
          toast.show({ type: "error", message: parsed.error.issues[0]?.message ?? "Invalid diagram JSON" });
          return;
        }
        loadDiagram(parsed.data, meta, readOnly);
        toast.show({ type: "success", message: "Diagram imported. Review and click Save to persist it." });
      } catch {
        toast.show({ type: "error", message: "File is not valid JSON." });
      }
    };
    reader.readAsText(file);
  }

  async function exportPng() {
    const el = document.querySelector(`#${CANVAS_DOM_ID} .react-flow`) as HTMLElement | null;
    if (!el) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(el, { backgroundColor: "#ffffff", pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${meta.name || "network-diagram"}.png`;
      a.click();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to export PNG" });
    } finally {
      setExporting(false);
    }
  }

  async function exportSvg() {
    const el = document.querySelector(`#${CANVAS_DOM_ID} .react-flow`) as HTMLElement | null;
    if (!el) return;
    setExporting(true);
    try {
      const dataUrl = await toSvg(el, { backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${meta.name || "network-diagram"}.svg`;
      a.click();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to export SVG" });
    } finally {
      setExporting(false);
    }
  }

  async function exportPdf() {
    const el = document.querySelector(`#${CANVAS_DOM_ID} .react-flow`) as HTMLElement | null;
    if (!el) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(el, { backgroundColor: "#ffffff", pixelRatio: 2 });
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not render image for PDF export"));
        img.src = dataUrl;
      });
      const pdf = new jsPDF({ orientation: img.width >= img.height ? "landscape" : "portrait", unit: "pt", format: [img.width, img.height] });
      pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
      pdf.save(`${meta.name || "network-diagram"}.pdf`);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to export PDF" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap",
        padding: "0.6rem 0.8rem", borderBottom: "1px solid var(--border)", background: "var(--surface)",
      }}
    >
      <Button size="sm" variant="ghost" onClick={onBack} title="Back to diagram list">
        <ArrowLeft size={14} />
      </Button>

      <input
        value={meta.name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Untitled diagram"
        disabled={readOnly}
        style={{
          padding: "0.4rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)",
          background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem", fontWeight: 600, minWidth: 200,
        }}
      />

      <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 0.2rem" }} />

      {!readOnly && (
        <>
          <Button size="sm" variant="secondary" onClick={() => onSave("Draft")} disabled={saving}>
            {saving ? "Saving..." : "Save as Draft"}
          </Button>
          <Button size="sm" variant="primary" onClick={() => onSave("Published")} disabled={saving}>
            <Save size={14} /> Save
          </Button>

          <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 0.2rem" }} />

          <Button size="sm" variant="ghost" onClick={undo} disabled={past.length === 0} title="Undo">
            <Undo2 size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={redo} disabled={future.length === 0} title="Redo">
            <Redo2 size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={copySelection} disabled={!hasSelection} title="Copy">
            <Copy size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={pasteClipboard} title="Paste">
            <ClipboardPaste size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={deleteSelected} disabled={!hasSelection} title="Delete">
            <Trash2 size={14} />
          </Button>

          <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 0.2rem" }} />
        </>
      )}

      <Button size="sm" variant="ghost" onClick={() => zoomIn()} title="Zoom in">
        <ZoomIn size={14} />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => zoomOut()} title="Zoom out">
        <ZoomOut size={14} />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => fitView()} title="Fit to screen">
        <Maximize2 size={14} />
      </Button>
      <Button size="sm" variant={showGrid ? "secondary" : "ghost"} onClick={toggleShowGrid} title="Toggle grid">
        <Grid3x3 size={14} />
      </Button>
      <Button size="sm" variant={snapToGrid ? "secondary" : "ghost"} onClick={toggleSnapToGrid} title="Toggle snap to grid">
        <Magnet size={14} />
      </Button>

      <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 0.2rem" }} />

      {!readOnly && (
        <>
          <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()} title="Import JSON">
            <Upload size={14} />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ""; }}
          />
        </>
      )}
      <Button size="sm" variant="ghost" onClick={exportJson} title="Export JSON">
        <Download size={14} />
      </Button>
      <Button size="sm" variant="ghost" onClick={exportPng} disabled={exporting} title="Export PNG">
        <ImageIcon size={14} />
      </Button>
      <Button size="sm" variant="ghost" onClick={exportSvg} disabled={exporting} title="Export SVG">
        <FileText size={14} />
      </Button>
      <Button size="sm" variant="ghost" onClick={exportPdf} disabled={exporting} title="Export PDF">
        <FileText size={14} />
      </Button>
      <Button size="sm" variant="ghost" onClick={toggleFullscreen} title="Fullscreen">
        {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
      </Button>
    </div>
  );
}

export { CANVAS_DOM_ID };
