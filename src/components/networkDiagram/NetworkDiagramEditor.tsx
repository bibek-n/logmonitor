"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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
import { Pencil, Plus, Save, X } from "lucide-react";
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
          { ...connection, id: crypto.randomUUID(), style: { stroke: "var(--primary)", strokeWidth: 2 }, data: { dashed: false } },
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
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", margin: 0 }}>{savedDiagram.title}</h1>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", margin: 0 }}>
              Solid lines are physical connections; dashed lines are logical connections.
            </p>
          </div>
          <Button size="sm" onClick={enterEdit}>
            <Pencil size={14} /> Edit
          </Button>
        </div>
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", padding: "1rem" }}>
          <DiagramView diagram={savedDiagram} />
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
