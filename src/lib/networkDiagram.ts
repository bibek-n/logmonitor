import { Cloud, ShieldCheck, Router, Server, Database, GitBranch, Monitor, Laptop2, Wifi, type LucideIcon } from "lucide-react";

export type IconKey = "isp" | "firewall" | "router" | "switch" | "database" | "git" | "pc" | "laptop" | "wifi";

export const ICONS: Record<IconKey, LucideIcon> = {
  isp: Cloud,
  firewall: ShieldCheck,
  router: Router,
  switch: Server,
  database: Database,
  git: GitBranch,
  pc: Monitor,
  laptop: Laptop2,
  wifi: Wifi,
};

export const ICON_LABELS: Record<IconKey, string> = {
  isp: "ISP / Cloud",
  firewall: "Firewall",
  router: "Router",
  switch: "Server / Switch",
  database: "Database Server",
  git: "Git Server",
  pc: "PC",
  laptop: "Laptop",
  wifi: "Wi-Fi AP",
};

export type HandleSide = "top" | "bottom" | "left" | "right";

export interface DiagramNode {
  id: string;
  iconKey: IconKey;
  title: string;
  subtitle?: string;
  tone?: "default" | "firewall";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DiagramZone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  dashed: boolean;
  sourceHandle?: HandleSide;
  targetHandle?: HandleSide;
}

export interface DiagramNote {
  id: string;
  x: number;
  y: number;
  w: number;
  text: string;
  align?: "left" | "center" | "right";
  iconKey?: IconKey;
}

export interface DiagramDoc {
  version: 1;
  title: string;
  canvas: { width: number; height: number };
  nodes: DiagramNode[];
  zones: DiagramZone[];
  edges: DiagramEdge[];
  notes: DiagramNote[];
}

// Deliberately generic placeholder — this repo is public, so no real infrastructure
// data (real IPs, ISP names, internal hostnames) is ever hardcoded here. The real
// topology is entered once by hand through the editor itself, directly on production.
export const DEFAULT_DIAGRAM: DiagramDoc = {
  version: 1,
  title: "Enterprise Network Topology",
  canvas: { width: 1520, height: 1050 },
  zones: [
    { id: "zone-wan", label: "ISP & WAN", x: 440, y: 20, w: 640, h: 260 },
    { id: "zone-firewall", label: "Firewall", x: 440, y: 300, w: 640, h: 180 },
    { id: "zone-lan", label: "LAN — 192.0.2.0/24", x: 20, y: 500, w: 1480, h: 360 },
  ],
  nodes: [
    { id: "isp", iconKey: "isp", title: "ISP", x: 700, y: 40, w: 120, h: 60 },
    { id: "firewall", iconKey: "firewall", title: "Firewall", tone: "firewall", x: 650, y: 350, w: 220, h: 80 },
    { id: "switch", iconKey: "switch", title: "Switch", x: 700, y: 545, w: 160, h: 56 },
    { id: "pc", iconKey: "pc", title: "PCs", x: 500, y: 650, w: 130, h: 60 },
    { id: "wifi", iconKey: "wifi", title: "Wi-Fi AP", x: 900, y: 650, w: 130, h: 60 },
  ],
  edges: [
    { id: "e1", source: "isp", target: "firewall", dashed: false },
    { id: "e2", source: "firewall", target: "switch", dashed: false },
    { id: "e3", source: "switch", target: "pc", dashed: false },
    { id: "e4", source: "switch", target: "wifi", dashed: false },
  ],
  notes: [],
};

export function validateDiagram(value: unknown): value is DiagramDoc {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  if (typeof d.title !== "string" || d.title.length === 0 || d.title.length > 200) return false;
  if (!d.canvas || typeof d.canvas !== "object") return false;
  const canvas = d.canvas as Record<string, unknown>;
  if (typeof canvas.width !== "number" || typeof canvas.height !== "number") return false;
  if (!Array.isArray(d.nodes) || !Array.isArray(d.zones) || !Array.isArray(d.edges) || !Array.isArray(d.notes)) {
    return false;
  }

  const nodeIds = new Set<string>();
  for (const n of d.nodes) {
    if (!n || typeof n !== "object") return false;
    const node = n as Record<string, unknown>;
    if (typeof node.id !== "string" || nodeIds.has(node.id)) return false;
    if (typeof node.iconKey !== "string" || !(node.iconKey in ICONS)) return false;
    if (typeof node.title !== "string") return false;
    if (
      typeof node.x !== "number" ||
      typeof node.y !== "number" ||
      typeof node.w !== "number" ||
      typeof node.h !== "number"
    ) {
      return false;
    }
    nodeIds.add(node.id);
  }

  for (const z of d.zones) {
    if (!z || typeof z !== "object") return false;
    const zone = z as Record<string, unknown>;
    if (typeof zone.id !== "string" || typeof zone.label !== "string") return false;
    if (
      typeof zone.x !== "number" ||
      typeof zone.y !== "number" ||
      typeof zone.w !== "number" ||
      typeof zone.h !== "number"
    ) {
      return false;
    }
  }

  for (const e of d.edges) {
    if (!e || typeof e !== "object") return false;
    const edge = e as Record<string, unknown>;
    if (typeof edge.id !== "string") return false;
    if (typeof edge.source !== "string" || !nodeIds.has(edge.source)) return false;
    if (typeof edge.target !== "string" || !nodeIds.has(edge.target)) return false;
    if (typeof edge.dashed !== "boolean") return false;
  }

  for (const note of d.notes) {
    if (!note || typeof note !== "object") return false;
    const n = note as Record<string, unknown>;
    if (typeof n.id !== "string" || typeof n.text !== "string") return false;
    if (typeof n.x !== "number" || typeof n.y !== "number" || typeof n.w !== "number") return false;
  }

  return true;
}
