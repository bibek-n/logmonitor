// Types for the new multi-diagram "Design New Diagram" designer. Entirely separate from
// src/lib/networkDiagram.ts (the legacy single-diagram module) — no shared types, no shared
// state, so the two systems can never accidentally couple. This module's persisted shape uses
// @xyflow/react-compatible node/edge structures directly (data payload only; position/id/etc.
// still come from @xyflow/react's own Node<T>/Edge<T> generics in the editor), unlike the
// legacy DiagramDoc's custom flat x/y/w/h shape.

export type NetworkDeviceCategory =
  | "network" | "wireless" | "servers" | "storage" | "end-user" | "cloud-virtualization" | "locations";

export type NetworkDeviceType =
  // Network Devices
  | "router" | "l2-switch" | "l3-switch" | "firewall" | "load-balancer" | "vpn-gateway" | "modem" | "internet-cloud"
  // Wireless Devices
  | "access-point" | "wireless-controller" | "wifi-client"
  // Servers
  | "physical-server" | "virtual-server" | "web-server" | "database-server" | "dns-server" | "dhcp-server" | "ad-server" | "backup-server" | "hypervisor"
  // Storage
  | "nas" | "san" | "cloud-storage"
  // End-User Devices
  | "desktop" | "laptop" | "mobile-phone" | "printer" | "ip-phone" | "cctv-camera"
  // Cloud and Virtualization
  | "public-cloud" | "private-cloud" | "virtual-network" | "container" | "kubernetes-cluster"
  // Locations
  | "head-office" | "branch-office" | "data-center" | "building" | "floor" | "rack";

export type DeviceStatus = "active" | "inactive" | "maintenance" | "planned" | "decommissioned";
export type LabelPosition = "top" | "bottom" | "left" | "right" | "center";
export type BackgroundStyle = "solid" | "gradient" | "outline" | "none";
export type BorderStyle = "solid" | "dashed" | "dotted" | "none";

export interface NetworkDiagramNodeData {
  deviceType: NetworkDeviceType;
  label: string; // display name
  hostname?: string;
  vendor?: string;
  model?: string;
  managementIp?: string;
  macAddress?: string;
  serialNumber?: string;
  operatingSystem?: string;
  firmwareVersion?: string;
  location?: string;
  rack?: string;
  vlan?: string;
  subnet?: string;
  defaultGateway?: string;
  status?: DeviceStatus;
  notes?: string;
  icon?: NetworkDeviceType;
  labelPosition?: LabelPosition;
  backgroundStyle?: BackgroundStyle;
  borderStyle?: BorderStyle;
  customFields?: Record<string, string>;
  // Index signature so this satisfies @xyflow/react's Node<T extends Record<string, unknown>>
  // constraint in the designer's canvas layer — purely a TS-level allowance, has no effect on
  // the zod schema (schema.ts) or persisted JSON shape, both of which stay exact.
  [key: string]: unknown;
}

export interface NetworkDiagramNode {
  id: string;
  type: "networkDevice";
  position: { x: number; y: number };
  width?: number;
  height?: number;
  data: NetworkDiagramNodeData;
}

export type DuplexMode = "full" | "half" | "auto";
export type MediaType = "copper" | "fiber" | "wireless" | "virtual";
export type PortMode = "access" | "trunk";
export type LinkStatus = "up" | "down" | "planned";
export type LinkRole = "primary" | "backup";
export type LineType = "solid" | "dashed" | "dotted";
export type ArrowType = "none" | "arrow" | "arrow-both" | "circle" | "diamond";

export interface NetworkDiagramEdgeData {
  label?: string; // connection name
  sourceInterface?: string;
  destinationInterface?: string;
  speed?: string; // link speed, e.g. "1Gbps"
  duplex?: DuplexMode;
  mediaType?: MediaType;
  portMode?: PortMode;
  nativeVlan?: string;
  allowedVlans?: string;
  ipSubnet?: string;
  routingProtocol?: string;
  status?: LinkStatus;
  role?: LinkRole;
  notes?: string;
  lineType?: LineType;
  lineWidth?: number;
  arrowType?: ArrowType;
  labelPosition?: LabelPosition;
  [key: string]: unknown;
}

export interface NetworkDiagramEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: "top" | "bottom" | "left" | "right";
  targetHandle?: "top" | "bottom" | "left" | "right";
  type?: "smoothstep" | "straight" | "step" | "bezier";
  data?: NetworkDiagramEdgeData;
}

export interface NetworkDiagramData {
  schemaVersion: number;
  viewport: { x: number; y: number; zoom: number };
  settings: {
    showGrid: boolean;
    snapToGrid: boolean;
    gridSize: number;
  };
  nodes: NetworkDiagramNode[];
  edges: NetworkDiagramEdge[];
}

export const CURRENT_SCHEMA_VERSION = 1;

export const DIAGRAM_LIMITS = {
  maxNodes: 500,
  maxEdges: 1000,
  maxNameLength: 200,
  maxDescriptionLength: 1000,
  maxLabelLength: 200,
  maxFieldLength: 200,
  maxNotesLength: 2000,
  maxCustomFields: 20,
} as const;

export type NetworkDiagramDesignStatus = "Draft" | "Published" | "Archived";
