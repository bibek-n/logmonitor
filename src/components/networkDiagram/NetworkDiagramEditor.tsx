"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./networkDiagram.css";
import { Pencil, Plus, Save, X, Box, Square, Download, FileText, Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { DiagramView } from "./DiagramView";
import { NodeEditModal } from "./NodeEditModal";
import { ZoneEditModal } from "./ZoneEditModal";
import { EdgeEditModal } from "./EdgeEditModal";
import { DeviceNode, type DeviceNodeData } from "./nodes/DeviceNode";
import { ZoneNode, type ZoneNodeData } from "./nodes/ZoneNode";
import type { DiagramDoc, DiagramNode, DiagramZone, DiagramEdge } from "@/lib/networkDiagram";

const NODE_TYPES = { device: DeviceNode, zone: ZoneNode };

function diagramToFlowNodes(diagram: DiagramDoc): Node[] {
  const zoneNodes: Node<ZoneNodeData>[] = diagram.zones.map((z) => ({
    id: z.id,
    type: "zone",
    position: { x: z.x, y: z.y },
    style: { width: z.w, height: z.h },
    data: { label: z.label },
    draggable: true,
    selectable: true,
    zIndex: 0,
  }));
  const deviceNodes: Node<DeviceNodeData>[] = diagram.nodes.map((n) => ({
    id: n.id,
    type: "device",
    position: { x: n.x, y: n.y },
    style: { width: n.w, height: n.h },
    data: { iconKey: n.iconKey, title: n.title, subtitle: n.subtitle, tone: n.tone },
    zIndex: 1,
  }));
  return [...zoneNodes, ...deviceNodes];
}

function diagramToFlowEdges(diagram: DiagramDoc): Edge[] {
  return diagram.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ? `${e.sourceHandle}-source` : undefined,
    targetHandle: e.targetHandle ? `${e.targetHandle}-target` : undefined,
    style: { stroke: "var(--primary)", strokeWidth: 2, strokeDasharray: e.dashed ? "6 5" : undefined },
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--primary)" },
    data: { dashed: e.dashed },
  }));
}

function flowToDiagram(nodes: Node[], edges: Edge[], title: string, notes: DiagramDoc["notes"], canvas: DiagramDoc["canvas"]): DiagramDoc {
  const zones: DiagramZone[] = nodes
    .filter((n) => n.type === "zone")
    .map((n) => ({
      id: n.id,
      label: (n.data as ZoneNodeData).label,
      x: n.position.x,
      y: n.position.y,
      w: typeof n.width === "number" ? n.width : Number(n.style?.width ?? 200),
      h: typeof n.height === "number" ? n.height : Number(n.style?.height ?? 150),
    }));
  const devices: DiagramNode[] = nodes
    .filter((n) => n.type === "device")
    .map((n) => {
      const data = n.data as DeviceNodeData;
      return {
        id: n.id,
        iconKey: data.iconKey,
        title: data.title,
        subtitle: data.subtitle,
        tone: data.tone,
        x: n.position.x,
        y: n.position.y,
        w: typeof n.width === "number" ? n.width : Number(n.style?.width ?? 140),
        h: typeof n.height === "number" ? n.height : Number(n.style?.height ?? 60),
      };
    });
  const diagramEdges: DiagramEdge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    dashed: !!(e.data as { dashed?: boolean } | undefined)?.dashed,
    sourceHandle: e.sourceHandle?.replace("-source", "") as DiagramEdge["sourceHandle"],
    targetHandle: e.targetHandle?.replace("-target", "") as DiagramEdge["targetHandle"],
  }));

  return { version: 1, title, canvas, nodes: devices, zones, edges: diagramEdges, notes };
}

function blankDevice(): DiagramNode {
  return { id: crypto.randomUUID(), iconKey: "pc", title: "New Device", x: 80, y: 80, w: 130, h: 60 };
}

function blankZone(): DiagramZone {
  return { id: crypto.randomUUID(), label: "New Zone", x: 40, y: 40, w: 300, h: 220 };
}

type PendingDelete = { kind: "node" | "zone" | "edge"; id: string } | null;

function EditorInner({ initialDiagram }: { initialDiagram: DiagramDoc }) {
  const toast = useToast();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [savedDiagram, setSavedDiagram] = useState(initialDiagram);
  const [title, setTitle] = useState(initialDiagram.title);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [viewStyle, setViewStyle] = useState<"2d" | "3d">("2d");
  const [rotateX, setRotateX] = useState(38);
  const [rotateY, setRotateY] = useState(0);
  const [exporting, setExporting] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; startRotateX: number; startRotateY: number } | null>(null);
  // A second, always-flat copy of the diagram rendered off-screen purely for export - the
  // visible one may have a 3D CSS transform applied (rotateX/rotateY), and capturing that
  // directly is unreliable: html-to-image measures the element's post-transform (foreshortened)
  // bounding box, then renders the full-size content into that undersized canvas, which is
  // exactly what was cropping exports to "half" the diagram. Exporting from an untransformed
  // clone sidesteps the problem entirely and always produces the complete diagram.
  const exportCaptureRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fitScale, setFitScale] = useState(1);

  // Fullscreen can also be exited via the browser's own Escape-key handling (not just our
  // button), so state has to be driven off the actual fullscreenchange event rather than
  // just toggled locally, or the button would get out of sync with reality.
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === fullscreenRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (fullscreenRef.current) {
      await fullscreenRef.current.requestFullscreen();
    }
  }

  // Recomputes the scale factor that makes the diagram's full bounding box fit inside the
  // fullscreen viewport - only relevant in fullscreen; the normal (non-fullscreen) panel keeps
  // its existing 100%-scale, scrollable behavior unchanged.
  useEffect(() => {
    function recomputeFit() {
      if (!isFullscreen) {
        setFitScale(1);
        return;
      }
      const scaleX = (window.innerWidth - 48) / savedDiagram.canvas.width;
      const scaleY = (window.innerHeight - 140) / savedDiagram.canvas.height;
      setFitScale(Math.min(1, scaleX, scaleY));
    }
    recomputeFit();
    window.addEventListener("resize", recomputeFit);
    return () => window.removeEventListener("resize", recomputeFit);
  }, [isFullscreen, savedDiagram.canvas.width, savedDiagram.canvas.height]);

  function onDragStart(e: ReactMouseEvent) {
    if (viewStyle !== "3d") return;
    dragState.current = { startX: e.clientX, startY: e.clientY, startRotateX: rotateX, startRotateY: rotateY };
  }
  function onDragMove(e: ReactMouseEvent) {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setRotateY(dragState.current.startRotateY + dx * 0.4);
    setRotateX(Math.max(0, Math.min(80, dragState.current.startRotateX - dy * 0.4)));
  }
  function onDragEnd() {
    dragState.current = null;
  }

  async function captureDiagramPng(): Promise<string> {
    if (!exportCaptureRef.current) throw new Error("Nothing to export yet.");
    return toPng(exportCaptureRef.current, { backgroundColor: "#ffffff", pixelRatio: 2 });
  }

  async function handleDownloadImage() {
    setExporting(true);
    try {
      const dataUrl = await captureDiagramPng();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${savedDiagram.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "network-diagram"}.png`;
      a.click();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to export image" });
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadPdf() {
    setExporting(true);
    try {
      const dataUrl = await captureDiagramPng();
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to prepare image for PDF."));
        img.src = dataUrl;
      });
      const pdf = new jsPDF({ orientation: img.width >= img.height ? "landscape" : "portrait", unit: "pt", format: [img.width, img.height] });
      pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
      pdf.save(`${savedDiagram.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "network-diagram"}.pdf`);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to export PDF" });
    } finally {
      setExporting(false);
    }
  }

  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([]);

  const [editingNode, setEditingNode] = useState<{ node: DiagramNode; isNew: boolean } | null>(null);
  const [editingZone, setEditingZone] = useState<{ zone: DiagramZone; isNew: boolean } | null>(null);
  const [editingEdge, setEditingEdge] = useState<DiagramEdge | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) => {
      onNodesChangeBase(changes);
      setDirty(true);
    },
    [onNodesChangeBase]
  );
  const onEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeBase>[0]) => {
      onEdgesChangeBase(changes);
      setDirty(true);
    },
    [onEdgesChangeBase]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: crypto.randomUUID(),
            style: { stroke: "var(--primary)", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "var(--primary)" },
            data: { dashed: false },
          },
          eds
        )
      );
      setDirty(true);
    },
    [setEdges]
  );

  function enterEdit() {
    setNodes(diagramToFlowNodes(savedDiagram));
    setEdges(diagramToFlowEdges(savedDiagram));
    setTitle(savedDiagram.title);
    setDirty(false);
    setMode("edit");
  }

  function requestLeaveEdit() {
    if (dirty) setConfirmDiscard(true);
    else setMode("view");
  }

  function discardAndLeave() {
    setConfirmDiscard(false);
    setMode("view");
  }

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === "zone") {
        const data = node.data as ZoneNodeData;
        setEditingZone({
          zone: {
            id: node.id,
            label: data.label,
            x: node.position.x,
            y: node.position.y,
            w: typeof node.width === "number" ? node.width : Number(node.style?.width ?? 200),
            h: typeof node.height === "number" ? node.height : Number(node.style?.height ?? 150),
          },
          isNew: false,
        });
      } else if (node.type === "device") {
        const data = node.data as DeviceNodeData;
        setEditingNode({
          node: {
            id: node.id,
            iconKey: data.iconKey,
            title: data.title,
            subtitle: data.subtitle,
            tone: data.tone,
            x: node.position.x,
            y: node.position.y,
            w: typeof node.width === "number" ? node.width : Number(node.style?.width ?? 140),
            h: typeof node.height === "number" ? node.height : Number(node.style?.height ?? 60),
          },
          isNew: false,
        });
      }
    },
    []
  );

  const onEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    setEditingEdge({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      dashed: !!(edge.data as { dashed?: boolean } | undefined)?.dashed,
    });
  }, []);

  function saveNode(updated: DiagramNode) {
    setNodes((ns) => {
      const exists = ns.some((n) => n.id === updated.id);
      const data: DeviceNodeData = { iconKey: updated.iconKey, title: updated.title, subtitle: updated.subtitle, tone: updated.tone };
      if (!exists) {
        return [...ns, { id: updated.id, type: "device", position: { x: updated.x, y: updated.y }, style: { width: updated.w, height: updated.h }, data, zIndex: 1 }];
      }
      return ns.map((n) => (n.id === updated.id ? { ...n, data } : n));
    });
    setDirty(true);
    setEditingNode(null);
  }

  function saveZone(updated: DiagramZone) {
    setNodes((ns) => {
      const exists = ns.some((n) => n.id === updated.id);
      const data: ZoneNodeData = { label: updated.label };
      if (!exists) {
        return [
          { id: updated.id, type: "zone", position: { x: updated.x, y: updated.y }, style: { width: updated.w, height: updated.h }, data, zIndex: 0 },
          ...ns,
        ];
      }
      return ns.map((n) => (n.id === updated.id ? { ...n, data } : n));
    });
    setDirty(true);
    setEditingZone(null);
  }

  function saveEdge(updated: DiagramEdge) {
    setEdges((es) =>
      es.map((e) =>
        e.id === updated.id ? { ...e, data: { dashed: updated.dashed }, style: { ...e.style, strokeDasharray: updated.dashed ? "6 5" : undefined } } : e
      )
    );
    setDirty(true);
    setEditingEdge(null);
  }

  function confirmDeletion() {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "edge") {
      setEdges((es) => es.filter((e) => e.id !== pendingDelete.id));
    } else {
      setNodes((ns) => ns.filter((n) => n.id !== pendingDelete.id));
      setEdges((es) => es.filter((e) => e.source !== pendingDelete.id && e.target !== pendingDelete.id));
    }
    setDirty(true);
    setPendingDelete(null);
    setEditingNode(null);
    setEditingZone(null);
    setEditingEdge(null);
  }

  async function save() {
    if (!title.trim()) {
      toast.show({ type: "error", message: "Diagram title is required." });
      return;
    }
    setSaving(true);
    try {
      const doc = flowToDiagram(nodes, edges, title.trim(), savedDiagram.notes, savedDiagram.canvas);
      const res = await fetch("/api/admin/network-diagram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagram: doc }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save diagram");
      setSavedDiagram(doc);
      setDirty(false);
      toast.show({ type: "success", message: "Diagram saved." });
      setMode("view");
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save diagram" });
    } finally {
      setSaving(false);
    }
  }

  const nodeTypes = useMemo(() => NODE_TYPES, []);

  if (mode === "view") {
    return (
      <div
        ref={fullscreenRef}
        style={isFullscreen ? { background: "var(--surface)", padding: "1.5rem", height: "100vh", boxSizing: "border-box" } : undefined}
      >
        <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", margin: 0 }}>{savedDiagram.title}</h1>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", margin: 0 }}>
              Solid lines are physical connections (arrows show direction); dashed lines are logical connections.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex" style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              <button
                onClick={() => setViewStyle("2d")}
                className="flex items-center gap-1"
                style={{
                  padding: "0.4rem 0.7rem", fontSize: "0.78rem", border: "none", cursor: "pointer",
                  background: viewStyle === "2d" ? "var(--primary)" : "var(--surface-2)",
                  color: viewStyle === "2d" ? "#fff" : "var(--ink-muted)",
                }}
              >
                <Square size={13} /> 2D
              </button>
              <button
                onClick={() => setViewStyle("3d")}
                className="flex items-center gap-1"
                style={{
                  padding: "0.4rem 0.7rem", fontSize: "0.78rem", border: "none", cursor: "pointer",
                  background: viewStyle === "3d" ? "var(--primary)" : "var(--surface-2)",
                  color: viewStyle === "3d" ? "#fff" : "var(--ink-muted)",
                }}
              >
                <Box size={13} /> 3D
              </button>
            </div>
            <Button size="sm" variant="secondary" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />} {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </Button>
            <Button size="sm" variant="secondary" onClick={handleDownloadImage} disabled={exporting}>
              <Download size={14} /> Image
            </Button>
            <Button size="sm" variant="secondary" onClick={handleDownloadPdf} disabled={exporting}>
              <FileText size={14} /> PDF
            </Button>
            <Button size="sm" onClick={enterEdit}>
              <Pencil size={14} /> Edit
            </Button>
          </div>
        </div>
        {viewStyle === "3d" && (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0, marginBottom: "0.5rem" }}>
            Click and drag the diagram to rotate it.
          </p>
        )}
        <div
          style={{
            overflow: isFullscreen ? "hidden" : "auto",
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--surface)",
            padding: "1rem",
            perspective: viewStyle === "3d" ? "1600px" : undefined,
            display: isFullscreen ? "flex" : undefined,
            alignItems: isFullscreen ? "center" : undefined,
            justifyContent: isFullscreen ? "center" : undefined,
            height: isFullscreen ? "calc(100vh - 160px)" : undefined,
          }}
        >
          <div style={{ transform: `scale(${fitScale})`, transformOrigin: "top center" }}>
            <div
              onMouseDown={onDragStart}
              onMouseMove={onDragMove}
              onMouseUp={onDragEnd}
              onMouseLeave={onDragEnd}
              style={{
                transform: viewStyle === "3d" ? `rotateX(${rotateX}deg) rotateY(${rotateY}deg)` : "none",
                transformOrigin: "top center",
                transition: dragState.current ? "none" : "transform 0.15s ease",
                background: "var(--surface)",
                cursor: viewStyle === "3d" ? "grab" : "default",
                userSelect: "none",
              }}
            >
              <DiagramView diagram={savedDiagram} />
            </div>
          </div>
        </div>

        {/* Always-flat, off-screen copy used only as the export source - see captureDiagramPng. */}
        <div style={{ position: "fixed", top: 0, left: -100000, pointerEvents: "none" }} aria-hidden="true">
          <div ref={exportCaptureRef} style={{ background: "#ffffff" }}>
            <DiagramView diagram={savedDiagram} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: "0.75rem" }}>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          style={{
            fontSize: "1.1rem",
            fontWeight: 600,
            padding: "0.4rem 0.6rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--ink)",
            minWidth: 260,
          }}
        />
        <Button size="sm" variant="secondary" onClick={() => setEditingNode({ node: blankDevice(), isNew: true })}>
          <Plus size={14} /> Add Node
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setEditingZone({ zone: blankZone(), isNew: true })}>
          <Plus size={14} /> Add Zone
        </Button>
        <div style={{ marginLeft: "auto" }} className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={requestLeaveEdit} disabled={saving}>
            <X size={14} /> Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            <Save size={14} /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0, marginBottom: "0.5rem" }}>
        Drag nodes/zones to move them, drag from a node&apos;s edge to another node to connect them, click a node, zone, or connection to edit it.
      </p>

      <div className="network-diagram-flow" style={{ height: 700, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          deleteKeyCode={null}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>

      {editingNode && (
        <NodeEditModal
          node={editingNode.node}
          isNew={editingNode.isNew}
          onSave={saveNode}
          onDelete={editingNode.isNew ? undefined : () => setPendingDelete({ kind: "node", id: editingNode.node.id })}
          onClose={() => setEditingNode(null)}
        />
      )}
      {editingZone && (
        <ZoneEditModal
          zone={editingZone.zone}
          isNew={editingZone.isNew}
          onSave={saveZone}
          onDelete={editingZone.isNew ? undefined : () => setPendingDelete({ kind: "zone", id: editingZone.zone.id })}
          onClose={() => setEditingZone(null)}
        />
      )}
      {editingEdge && (
        <EdgeEditModal
          edge={editingEdge}
          onSave={saveEdge}
          onDelete={() => setPendingDelete({ kind: "edge", id: editingEdge.id })}
          onClose={() => setEditingEdge(null)}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDeletion}
        title="Delete item"
        message="This removes it from the diagram (and any connections attached to it, if it's a node or zone). This only takes effect once you Save."
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={discardAndLeave}
        title="Discard changes?"
        message="You have unsaved changes to this diagram. Leaving edit mode now will discard them."
        confirmLabel="Discard"
      />
    </div>
  );
}

export function NetworkDiagramEditor({ initialDiagram }: { initialDiagram: DiagramDoc }) {
  return (
    <ToastProvider>
      <EditorInner initialDiagram={initialDiagram} />
    </ToastProvider>
  );
}
