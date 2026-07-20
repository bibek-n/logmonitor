import { CURRENT_SCHEMA_VERSION, type NetworkDiagramData } from "./types";

// The blank-canvas starting point for /network-diagram/designs/new — a fresh function call
// each time (not a shared constant object) so nothing can ever mutate a cached default.
export function createEmptyDiagram(): NetworkDiagramData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    viewport: { x: 0, y: 0, zoom: 1 },
    settings: { showGrid: true, snapToGrid: true, gridSize: 20 },
    nodes: [],
    edges: [],
  };
}
