import { z } from "zod";
import { CURRENT_SCHEMA_VERSION, DIAGRAM_LIMITS } from "./types";

// Zod validation for the new designer's diagram JSON — the app-level gate enforced on every
// create/update request (src/app/api/admin/network-diagram-designs/**), independent of the
// DB's CHECK(ISJSON(...)) constraint (which only proves "valid JSON", not "valid diagram").

const DEVICE_TYPES = [
  "router", "l2-switch", "l3-switch", "firewall", "load-balancer", "vpn-gateway", "modem", "internet-cloud",
  "access-point", "wireless-controller", "wifi-client",
  "physical-server", "virtual-server", "web-server", "database-server", "dns-server", "dhcp-server", "ad-server", "backup-server", "hypervisor",
  "nas", "san", "cloud-storage",
  "desktop", "laptop", "mobile-phone", "printer", "ip-phone", "cctv-camera",
  "public-cloud", "private-cloud", "virtual-network", "container", "kubernetes-cluster",
  "head-office", "branch-office", "data-center", "building", "floor", "rack",
] as const;

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
// Accepts an optional /CIDR suffix (subnet field), colon or hyphen MAC separators.
const IPV4_CIDR_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}(\/(3[0-2]|[12]?\d))?$/;
const MAC_RE = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

const optionalField = (max: number) => z.string().max(max).optional().or(z.literal(""));

const ipField = z.string().refine((v) => v === "" || IPV4_RE.test(v), { message: "Must be a valid IPv4 address" }).optional().or(z.literal(""));
const subnetField = z.string().refine((v) => v === "" || IPV4_CIDR_RE.test(v), { message: "Must be a valid IPv4 address or CIDR" }).optional().or(z.literal(""));
const macField = z.string().refine((v) => v === "" || MAC_RE.test(v), { message: "Must be a valid MAC address (aa:bb:cc:dd:ee:ff)" }).optional().or(z.literal(""));

export const nodeDataSchema = z.object({
  deviceType: z.enum(DEVICE_TYPES),
  label: z.string().min(1).max(DIAGRAM_LIMITS.maxLabelLength),
  hostname: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  vendor: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  model: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  managementIp: ipField,
  macAddress: macField,
  serialNumber: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  operatingSystem: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  firmwareVersion: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  location: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  rack: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  vlan: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  subnet: subnetField,
  defaultGateway: ipField,
  status: z.enum(["active", "inactive", "maintenance", "planned", "decommissioned"]).optional(),
  notes: optionalField(DIAGRAM_LIMITS.maxNotesLength),
  icon: z.enum(DEVICE_TYPES).optional(),
  labelPosition: z.enum(["top", "bottom", "left", "right", "center"]).optional(),
  backgroundStyle: z.enum(["solid", "gradient", "outline", "none"]).optional(),
  borderStyle: z.enum(["solid", "dashed", "dotted", "none"]).optional(),
  customFields: z.record(z.string().max(100), z.string().max(DIAGRAM_LIMITS.maxFieldLength))
    .refine((obj) => Object.keys(obj).length <= DIAGRAM_LIMITS.maxCustomFields, {
      message: `At most ${DIAGRAM_LIMITS.maxCustomFields} custom fields`,
    })
    .optional(),
});

export const nodeSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.literal("networkDevice"),
  position: z.object({ x: z.number(), y: z.number() }),
  width: z.number().positive().max(2000).optional(),
  height: z.number().positive().max(2000).optional(),
  data: nodeDataSchema,
});

export const edgeDataSchema = z.object({
  label: optionalField(DIAGRAM_LIMITS.maxLabelLength),
  sourceInterface: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  destinationInterface: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  speed: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  duplex: z.enum(["full", "half", "auto"]).optional(),
  mediaType: z.enum(["copper", "fiber", "wireless", "virtual"]).optional(),
  portMode: z.enum(["access", "trunk"]).optional(),
  nativeVlan: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  allowedVlans: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  ipSubnet: subnetField,
  routingProtocol: optionalField(DIAGRAM_LIMITS.maxFieldLength),
  status: z.enum(["up", "down", "planned"]).optional(),
  role: z.enum(["primary", "backup"]).optional(),
  notes: optionalField(DIAGRAM_LIMITS.maxNotesLength),
  lineType: z.enum(["solid", "dashed", "dotted"]).optional(),
  lineWidth: z.number().positive().max(20).optional(),
  arrowType: z.enum(["none", "arrow", "arrow-both", "circle", "diamond"]).optional(),
  labelPosition: z.enum(["top", "bottom", "left", "right", "center"]).optional(),
}).optional();

export const edgeSchema = z.object({
  id: z.string().min(1).max(100),
  source: z.string().min(1).max(100),
  target: z.string().min(1).max(100),
  sourceHandle: z.enum(["top", "bottom", "left", "right"]).optional(),
  targetHandle: z.enum(["top", "bottom", "left", "right"]).optional(),
  type: z.enum(["smoothstep", "straight", "step", "bezier"]).optional(),
  data: edgeDataSchema,
});

export const networkDiagramDataSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number().positive().max(10) }),
  settings: z.object({
    showGrid: z.boolean(),
    snapToGrid: z.boolean(),
    gridSize: z.number().int().positive().max(200),
  }),
  nodes: z.array(nodeSchema).max(DIAGRAM_LIMITS.maxNodes),
  edges: z.array(edgeSchema).max(DIAGRAM_LIMITS.maxEdges),
}).superRefine((doc, ctx) => {
  const nodeIds = new Set(doc.nodes.map((n) => n.id));
  if (nodeIds.size !== doc.nodes.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate node id" });
  }
  for (const edge of doc.edges) {
    if (!nodeIds.has(edge.source)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Edge ${edge.id} references unknown source node ${edge.source}` });
    }
    if (!nodeIds.has(edge.target)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Edge ${edge.id} references unknown target node ${edge.target}` });
    }
  }
});

export const createDesignSchema = z.object({
  name: z.string().trim().min(1).max(DIAGRAM_LIMITS.maxNameLength),
  description: z.string().trim().max(DIAGRAM_LIMITS.maxDescriptionLength).optional().nullable(),
  status: z.enum(["Draft", "Published", "Archived"]).optional(),
  diagramData: networkDiagramDataSchema,
});

export const updateDesignSchema = z.object({
  name: z.string().trim().min(1).max(DIAGRAM_LIMITS.maxNameLength).optional(),
  description: z.string().trim().max(DIAGRAM_LIMITS.maxDescriptionLength).optional().nullable(),
  status: z.enum(["Draft", "Published", "Archived"]).optional(),
  diagramData: networkDiagramDataSchema.optional(),
});
