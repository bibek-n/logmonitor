import { create } from "zustand";
import {
  applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type NodeChange, type EdgeChange, type Connection, type Viewport,
} from "@xyflow/react";
import { createEmptyDiagram } from "./defaultDiagram";
import { getDeviceDefaultSize } from "./deviceLibrary";
import type {
  NetworkDiagramData, NetworkDiagramNodeData, NetworkDiagramEdgeData,
  NetworkDeviceType, NetworkDiagramDesignStatus,
} from "./types";

export type FlowNode = Node<NetworkDiagramNodeData>;
export type FlowEdge = Edge<NetworkDiagramEdgeData>;

interface HistorySnapshot {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface DiagramMeta {
  id: number | null;
  name: string;
  description: string;
  status: NetworkDiagramDesignStatus;
}

let nextEntityId = 1;
function genId(prefix: string): string {
  nextEntityId += 1;
  return `${prefix}-${Date.now().toString(36)}-${nextEntityId}`;
}

const MAX_HISTORY = 50;

interface DesignerState {
  meta: DiagramMeta;
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  viewport: Viewport;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  dirty: boolean;
  readOnly: boolean;
  saving: boolean;
  clipboard: HistorySnapshot | null;
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  loadDiagram: (data: NetworkDiagramData, meta: DiagramMeta, readOnly?: boolean) => void;
  resetToEmpty: () => void;
  toDiagramData: () => NetworkDiagramData;

  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setStatus: (status: NetworkDiagramDesignStatus) => void;
  markSaved: (id: number) => void;
  setSaving: (saving: boolean) => void;

  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;

  addDevice: (deviceType: NetworkDeviceType, position: { x: number; y: number }) => string;
  updateNodeData: (id: string, patch: Partial<NetworkDiagramNodeData>) => void;
  updateEdgeData: (id: string, patch: Partial<NetworkDiagramEdgeData>) => void;
  deleteSelected: () => void;

  selectNodes: (ids: string[]) => void;
  selectEdges: (ids: string[]) => void;
  clearSelection: () => void;

  copySelection: () => void;
  pasteClipboard: () => void;

  undo: () => void;
  redo: () => void;
  commitHistory: () => void;

  setViewport: (viewport: Viewport) => void;
  toggleShowGrid: () => void;
  toggleSnapToGrid: () => void;
  setGridSize: (size: number) => void;
}

function snapshot(state: DesignerState): HistorySnapshot {
  return { nodes: state.nodes, edges: state.edges };
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
  meta: { id: null, name: "", description: "", status: "Draft" },
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  selectedEdgeIds: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  showGrid: true,
  snapToGrid: true,
  gridSize: 20,
  dirty: false,
  readOnly: false,
  saving: false,
  clipboard: null,
  past: [],
  future: [],

  loadDiagram: (data, meta, readOnly = false) => {
    const nodes: FlowNode[] = data.nodes.map((n) => ({
      id: n.id, type: "networkDevice", position: n.position,
      width: n.width, height: n.height, data: n.data,
    }));
    const edges: FlowEdge[] = data.edges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      sourceHandle: e.sourceHandle ? `${e.sourceHandle}-source` : undefined,
      targetHandle: e.targetHandle ? `${e.targetHandle}-target` : undefined,
      type: e.type ?? "smoothstep", data: e.data ?? {},
    }));
    set({
      meta, nodes, edges,
      viewport: data.viewport,
      showGrid: data.settings.showGrid,
      snapToGrid: data.settings.snapToGrid,
      gridSize: data.settings.gridSize,
      dirty: false, readOnly, past: [], future: [],
      selectedNodeIds: [], selectedEdgeIds: [], clipboard: null,
    });
  },

  resetToEmpty: () => {
    const empty = createEmptyDiagram();
    get().loadDiagram(empty, { id: null, name: "", description: "", status: "Draft" }, false);
  },

  toDiagramData: () => {
    const s = get();
    return {
      schemaVersion: 1,
      viewport: s.viewport,
      settings: { showGrid: s.showGrid, snapToGrid: s.snapToGrid, gridSize: s.gridSize },
      nodes: s.nodes.map((n) => ({
        id: n.id, type: "networkDevice", position: n.position,
        width: n.width, height: n.height, data: n.data as NetworkDiagramNodeData,
      })),
      edges: s.edges.map((e) => ({
        id: e.id, source: e.source, target: e.target,
        sourceHandle: e.sourceHandle ? (e.sourceHandle.replace(/-source$/, "") as "top" | "bottom" | "left" | "right") : undefined,
        targetHandle: e.targetHandle ? (e.targetHandle.replace(/-target$/, "") as "top" | "bottom" | "left" | "right") : undefined,
        type: (e.type as "smoothstep" | "straight" | "step" | "bezier" | undefined) ?? "smoothstep",
        data: e.data as NetworkDiagramEdgeData,
      })),
    };
  },

  setName: (name) => set((s) => ({ meta: { ...s.meta, name }, dirty: true })),
  setDescription: (description) => set((s) => ({ meta: { ...s.meta, description }, dirty: true })),
  setStatus: (status) => set((s) => ({ meta: { ...s.meta, status }, dirty: true })),
  markSaved: (id) => set((s) => ({ meta: { ...s.meta, id }, dirty: false })),
  setSaving: (saving) => set({ saving }),

  onNodesChange: (changes) => {
    if (get().readOnly) return;
    set((s) => ({ nodes: applyNodeChanges<FlowNode>(changes, s.nodes) }));
    const settled = changes.some(
      (c) => (c.type === "position" && c.dragging === false) || c.type === "remove"
    );
    if (settled) get().commitHistory();
    if (changes.length > 0) set({ dirty: true });
  },

  onEdgesChange: (changes) => {
    if (get().readOnly) return;
    set((s) => ({ edges: applyEdgeChanges<FlowEdge>(changes, s.edges) }));
    if (changes.some((c) => c.type === "remove")) get().commitHistory();
    if (changes.length > 0) set({ dirty: true });
  },

  onConnect: (connection) => {
    if (get().readOnly) return;
    if (!connection.source || !connection.target) return;
    get().commitHistory();
    const edge: FlowEdge = {
      id: genId("edge"),
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
      type: "smoothstep",
      data: {},
    };
    set((s) => ({ edges: [...s.edges, edge], dirty: true }));
  },

  addDevice: (deviceType, position) => {
    if (get().readOnly) return "";
    get().commitHistory();
    const id = genId("node");
    const { width, height } = getDeviceDefaultSize(deviceType);
    const node: FlowNode = {
      id, type: "networkDevice", position, width, height,
      data: { deviceType, label: deviceType.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), status: "active" },
    };
    set((s) => ({ nodes: [...s.nodes, node], dirty: true, selectedNodeIds: [id], selectedEdgeIds: [] }));
    return id;
  },

  updateNodeData: (id, patch) => {
    if (get().readOnly) return;
    get().commitHistory();
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      dirty: true,
    }));
  },

  updateEdgeData: (id, patch) => {
    if (get().readOnly) return;
    get().commitHistory();
    set((s) => ({
      edges: s.edges.map((e) => (e.id === id ? { ...e, data: { ...(e.data ?? {}), ...patch } } : e)),
      dirty: true,
    }));
  },

  deleteSelected: () => {
    if (get().readOnly) return;
    const { selectedNodeIds, selectedEdgeIds } = get();
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return;
    get().commitHistory();
    set((s) => ({
      nodes: s.nodes.filter((n) => !selectedNodeIds.includes(n.id)),
      edges: s.edges.filter(
        (e) => !selectedEdgeIds.includes(e.id) && !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)
      ),
      selectedNodeIds: [], selectedEdgeIds: [], dirty: true,
    }));
  },

  selectNodes: (ids) => set({ selectedNodeIds: ids, selectedEdgeIds: [] }),
  selectEdges: (ids) => set({ selectedEdgeIds: ids, selectedNodeIds: [] }),
  clearSelection: () => set({ selectedNodeIds: [], selectedEdgeIds: [] }),

  copySelection: () => {
    const { nodes, edges, selectedNodeIds } = get();
    if (selectedNodeIds.length === 0) return;
    const copiedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
    const copiedEdges = edges.filter((e) => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target));
    set({ clipboard: { nodes: copiedNodes, edges: copiedEdges } });
  },

  pasteClipboard: () => {
    if (get().readOnly) return;
    const { clipboard } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;
    get().commitHistory();
    const idMap = new Map<string, string>();
    const newNodes: FlowNode[] = clipboard.nodes.map((n) => {
      const newId = genId("node");
      idMap.set(n.id, newId);
      return { ...n, id: newId, position: { x: n.position.x + 40, y: n.position.y + 40 }, selected: true };
    });
    const newEdges: FlowEdge[] = clipboard.edges.map((e) => ({
      ...e,
      id: genId("edge"),
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
    }));
    set((s) => ({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
      edges: [...s.edges, ...newEdges],
      selectedNodeIds: newNodes.map((n) => n.id),
      selectedEdgeIds: [],
      dirty: true,
    }));
  },

  commitHistory: () => {
    set((s) => ({
      past: [...s.past.slice(-(MAX_HISTORY - 1)), snapshot(s)],
      future: [],
    }));
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set((s) => ({
      past: s.past.slice(0, -1),
      future: [snapshot(s), ...s.future].slice(0, MAX_HISTORY),
      nodes: previous.nodes, edges: previous.edges,
      dirty: true,
    }));
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;
    const next = future[0];
    set((s) => ({
      future: s.future.slice(1),
      past: [...s.past, snapshot(s)].slice(-MAX_HISTORY),
      nodes: next.nodes, edges: next.edges,
      dirty: true,
    }));
  },

  setViewport: (viewport) => set({ viewport }),
  toggleShowGrid: () => set((s) => ({ showGrid: !s.showGrid, dirty: true })),
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid, dirty: true })),
  setGridSize: (gridSize) => set({ gridSize, dirty: true }),
}));
