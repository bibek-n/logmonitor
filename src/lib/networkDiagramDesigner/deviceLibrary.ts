import {
  Router, Network, Share2, ShieldCheck, Scale, Lock, Radio, Cloud,
  Wifi, RadioTower, Rss,
  Server, ServerCog, Globe, Database, Waypoints, ListTree, Users, Archive, Layers,
  HardDrive, HardDriveDownload, CloudCog,
  Monitor, Laptop2, Smartphone, Printer, Phone, Camera,
  GitBranch, Box, Boxes,
  Building2, Building, Warehouse, Home, Rows3,
  type LucideIcon,
} from "lucide-react";
import type { NetworkDeviceCategory, NetworkDeviceType } from "./types";

export const DEVICE_CATEGORY_LABELS: Record<NetworkDeviceCategory, string> = {
  network: "Network Devices",
  wireless: "Wireless",
  servers: "Servers",
  storage: "Storage",
  "end-user": "End-User",
  "cloud-virtualization": "Cloud & Virtualization",
  locations: "Locations",
};

export const DEVICE_CATEGORY_ORDER: NetworkDeviceCategory[] = [
  "network", "wireless", "servers", "storage", "end-user", "cloud-virtualization", "locations",
];

interface DeviceDefinition {
  type: NetworkDeviceType;
  category: NetworkDeviceCategory;
  label: string;
  icon: LucideIcon;
  width: number;
  height: number;
}

export const DEVICE_LIBRARY: DeviceDefinition[] = [
  // Network Devices
  { type: "router", category: "network", label: "Router", icon: Router, width: 140, height: 64 },
  { type: "l2-switch", category: "network", label: "L2 Switch", icon: Network, width: 140, height: 64 },
  { type: "l3-switch", category: "network", label: "L3 Switch", icon: Share2, width: 140, height: 64 },
  { type: "firewall", category: "network", label: "Firewall", icon: ShieldCheck, width: 140, height: 64 },
  { type: "load-balancer", category: "network", label: "Load Balancer", icon: Scale, width: 140, height: 64 },
  { type: "vpn-gateway", category: "network", label: "VPN Gateway", icon: Lock, width: 140, height: 64 },
  { type: "modem", category: "network", label: "Modem", icon: Radio, width: 140, height: 64 },
  { type: "internet-cloud", category: "network", label: "Internet / Cloud", icon: Cloud, width: 150, height: 70 },

  // Wireless
  { type: "access-point", category: "wireless", label: "Access Point", icon: Wifi, width: 140, height: 64 },
  { type: "wireless-controller", category: "wireless", label: "Wireless Controller", icon: RadioTower, width: 150, height: 64 },
  { type: "wifi-client", category: "wireless", label: "Wi-Fi Client", icon: Rss, width: 140, height: 64 },

  // Servers
  { type: "physical-server", category: "servers", label: "Physical Server", icon: Server, width: 150, height: 64 },
  { type: "virtual-server", category: "servers", label: "Virtual Server", icon: ServerCog, width: 150, height: 64 },
  { type: "web-server", category: "servers", label: "Web Server", icon: Globe, width: 140, height: 64 },
  { type: "database-server", category: "servers", label: "Database Server", icon: Database, width: 150, height: 64 },
  { type: "dns-server", category: "servers", label: "DNS Server", icon: Waypoints, width: 140, height: 64 },
  { type: "dhcp-server", category: "servers", label: "DHCP Server", icon: ListTree, width: 140, height: 64 },
  { type: "ad-server", category: "servers", label: "AD Server", icon: Users, width: 140, height: 64 },
  { type: "backup-server", category: "servers", label: "Backup Server", icon: Archive, width: 140, height: 64 },
  { type: "hypervisor", category: "servers", label: "Hypervisor", icon: Layers, width: 140, height: 64 },

  // Storage
  { type: "nas", category: "storage", label: "NAS", icon: HardDrive, width: 130, height: 64 },
  { type: "san", category: "storage", label: "SAN", icon: HardDriveDownload, width: 130, height: 64 },
  { type: "cloud-storage", category: "storage", label: "Cloud Storage", icon: CloudCog, width: 150, height: 64 },

  // End-User
  { type: "desktop", category: "end-user", label: "Desktop", icon: Monitor, width: 130, height: 64 },
  { type: "laptop", category: "end-user", label: "Laptop", icon: Laptop2, width: 130, height: 64 },
  { type: "mobile-phone", category: "end-user", label: "Mobile Phone", icon: Smartphone, width: 140, height: 64 },
  { type: "printer", category: "end-user", label: "Printer", icon: Printer, width: 130, height: 64 },
  { type: "ip-phone", category: "end-user", label: "IP Phone", icon: Phone, width: 130, height: 64 },
  { type: "cctv-camera", category: "end-user", label: "CCTV Camera", icon: Camera, width: 140, height: 64 },

  // Cloud and Virtualization
  { type: "public-cloud", category: "cloud-virtualization", label: "Public Cloud", icon: Cloud, width: 150, height: 70 },
  { type: "private-cloud", category: "cloud-virtualization", label: "Private Cloud", icon: CloudCog, width: 150, height: 70 },
  { type: "virtual-network", category: "cloud-virtualization", label: "Virtual Network", icon: GitBranch, width: 150, height: 64 },
  { type: "container", category: "cloud-virtualization", label: "Container", icon: Box, width: 130, height: 64 },
  { type: "kubernetes-cluster", category: "cloud-virtualization", label: "Kubernetes Cluster", icon: Boxes, width: 160, height: 64 },

  // Locations
  { type: "head-office", category: "locations", label: "Head Office", icon: Building2, width: 160, height: 70 },
  { type: "branch-office", category: "locations", label: "Branch Office", icon: Building, width: 160, height: 70 },
  { type: "data-center", category: "locations", label: "Data Center", icon: Warehouse, width: 160, height: 70 },
  { type: "building", category: "locations", label: "Building", icon: Home, width: 150, height: 70 },
  { type: "floor", category: "locations", label: "Floor", icon: Rows3, width: 150, height: 64 },
  { type: "rack", category: "locations", label: "Rack", icon: Server, width: 130, height: 64 },
];

export const DEVICE_BY_TYPE: Record<NetworkDeviceType, DeviceDefinition> = Object.fromEntries(
  DEVICE_LIBRARY.map((d) => [d.type, d])
) as Record<NetworkDeviceType, DeviceDefinition>;

export function getDeviceIcon(type: NetworkDeviceType): LucideIcon {
  return DEVICE_BY_TYPE[type]?.icon ?? Server;
}

export function getDeviceDefaultSize(type: NetworkDeviceType): { width: number; height: number } {
  const d = DEVICE_BY_TYPE[type];
  return d ? { width: d.width, height: d.height } : { width: 140, height: 64 };
}
