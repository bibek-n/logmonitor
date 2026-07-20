"use client";

import { useCallback, useRef } from "react";
import {
  ReactFlow, Background, BackgroundVariant, type OnSelectionChangeParams,
} from "@xyflow/react";
import { useDesignerStore } from "@/lib/networkDiagramDesigner/store";
import { NetworkDeviceNode } from "./NetworkDeviceNode";
import type { NetworkDeviceType } from "@/lib/networkDiagramDesigner/types";

const NODE_TYPES = { networkDevice: NetworkDeviceNode };

export const DEVICE_DRAG_MIME = "application/x-network-device-type";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function DiagramCanvas() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const nodes = useDesignerStore((s) => s.nodes);
  const edges = useDesignerStore((s) => s.edges);
  const showGrid = useDesignerStore((s) => s.showGrid);
  const snapToGrid = useDesignerStore((s) => s.snapToGrid);
  const gridSize = useDesignerStore((s) => s.gridSize);
  const readOnly = useDesignerStore((s) => s.readOnly);
  const onNodesChange = useDesignerStore((s) => s.onNodesChange);
  const onEdgesChange = useDesignerStore((s) => s.onEdgesChange);
  const onConnect = useDesignerStore((s) => s.onConnect);
  const addDevice = useDesignerStore((s) => s.addDevice);
  const selectNodes = useDesignerStore((s) => s.selectNodes);
  const selectEdges = useDesignerStore((s) => s.selectEdges);
  const clearSelection = useDesignerStore((s) => s.clearSelection);
  const deleteSelected = useDesignerStore((s) => s.deleteSelected);
  const copySelection = useDesignerStore((s) => s.copySelection);
  const pasteClipboard = useDesignerStore((s) => s.pasteClipboard);
  const undo = useDesignerStore((s) => s.undo);
  const redo = useDesignerStore((s) => s.redo);
  const setViewport = useDesignerStore((s) => s.setViewport);

  const handleSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
      if (selNodes.length > 0) selectNodes(selNodes.map((n) => n.id));
      else if (selEdges.length > 0) selectEdges(selEdges.map((e) => e.id));
      else clearSelection();
    },
    [selectNodes, selectEdges, clearSelection]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (readOnly) return;
      const deviceType = event.dataTransfer.getData(DEVICE_DRAG_MIME) as NetworkDeviceType | "";
      if (!deviceType) return;
      const bounds = wrapperRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const dropX = event.clientX - bounds.left;
      const dropY = event.clientY - bounds.top;
      addDevice(deviceType, { x: dropX, y: dropY });
    },
    [addDevice, readOnly]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const meta = event.ctrlKey || event.metaKey;
      if ((event.key === "Delete" || event.key === "Backspace") && !readOnly) {
        event.preventDefault();
        deleteSelected();
      } else if (meta && event.key.toLowerCase() === "c") {
        copySelection();
      } else if (meta && event.key.toLowerCase() === "v" && !readOnly) {
        event.preventDefault();
        pasteClipboard();
      } else if (meta && !event.shiftKey && event.key.toLowerCase() === "z" && !readOnly) {
        event.preventDefault();
        undo();
      } else if (meta && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z")) && !readOnly) {
        event.preventDefault();
        redo();
      }
    },
    [readOnly, deleteSelected, copySelection, pasteClipboard, undo, redo]
  );

  return (
    <div
      ref={wrapperRef}
      className="network-diagram-flow"
      style={{ width: "100%", height: "100%", outline: "none" }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={handleSelectionChange}
        onMoveEnd={(_e, viewport) => setViewport(viewport)}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        snapToGrid={snapToGrid}
        snapGrid={[gridSize, gridSize]}
        multiSelectionKeyCode={["Shift", "Meta", "Control"]}
        deleteKeyCode={null}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        {showGrid && <Background variant={BackgroundVariant.Dots} gap={gridSize} size={1} />}
      </ReactFlow>
    </div>
  );
}
