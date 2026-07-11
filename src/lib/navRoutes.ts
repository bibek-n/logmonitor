import {
  LayoutDashboard,
  Users,
  Router,
  Laptop2,
  ScrollText,
  Globe,
  ShieldCheck,
  Wifi,
  Filter,
  Activity,
  Wrench,
  Radar,
  Route as RouteIcon,
  Server,
  Search,
  SearchCode,
  Clock,
  RotateCcw,
  Waypoints,
  Globe2,
  HeartPulse,
  Lock,
  FileCode,
  BarChart3,
  Mail,
  Send,
  MailCheck,
  Ban,
  Gauge,
  History,
  Network,
  Fingerprint,
  BookOpen,
  ShieldAlert,
  Binary,
  EyeOff,
  Monitor,
  KeyRound,
  Download,
  Image as ImageIcon,
  Ticket,
  Inbox,
  Layers,
  Settings,
  PlusCircle,
  Workflow,
  type LucideIcon,
} from "lucide-react";

// `key` is the translation lookup (see messages/<locale>.json under "sidebar") — `label`
// stays as the English fallback/default and is what non-i18n-aware code (SEARCH_INDEX
// consumers building it without translations available) falls back to.
export interface NavItem {
  href: string;
  key: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const TOP_ITEMS: NavItem[] = [
  { href: "/dashboard", key: "overview", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/staff", key: "staff", label: "Employees", icon: Users },
  { href: "/dashboard/network-diagram", key: "networkDiagram", label: "Network Diagram", icon: Workflow },
  { href: "/dashboard/settings", key: "companySettings", label: "Company Settings", icon: Settings },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "mikrotikRouter",
    label: "Mikrotik Router",
    icon: Router,
    items: [
      { href: "/dashboard/router-clients", key: "routerClients", label: "Router Clients", icon: Laptop2 },
      { href: "/dashboard/router-health", key: "routerHealth", label: "Router Health", icon: HeartPulse },
      { href: "/dashboard/router-logs", key: "routerLogs", label: "Router Logs", icon: ScrollText },
      { href: "/dashboard/router-web", key: "routerWeb", label: "Router Web Connections", icon: Globe },
    ],
  },
  {
    key: "sophosFirewall",
    label: "Sophos Firewall",
    icon: ShieldCheck,
    items: [
      { href: "/dashboard/sophos-clients", key: "sophosClients", label: "Sophos Clients", icon: Wifi },
      { href: "/dashboard/web-filter", key: "webFilter", label: "Sophos Web Filter", icon: Filter },
      { href: "/dashboard/system-health", key: "systemHealth", label: "Sophos System Health", icon: Activity },
      { href: "/dashboard/sophos-events", key: "sophosEvents", label: "Sophos Events", icon: ScrollText },
    ],
  },
  {
    key: "networkTools",
    label: "Network Tools",
    icon: Wrench,
    items: [
      { href: "/dashboard/network-tools/ping", key: "ping", label: "Ping", icon: Radar },
      { href: "/dashboard/network-tools/traceroute", key: "traceroute", label: "Traceroute", icon: RouteIcon },
      { href: "/dashboard/network-tools/host", key: "host", label: "Host", icon: Server },
      { href: "/dashboard/network-tools/dns-check", key: "dnsCheck", label: "DNS Check", icon: Search },
      { href: "/dashboard/network-tools/nslookup", key: "nslookup", label: "Nslookup", icon: SearchCode },
      { href: "/dashboard/network-tools/ntp-test", key: "ntpTest", label: "NTP Server Test", icon: Clock },
      { href: "/dashboard/network-tools/reverse-dns", key: "reverseDns", label: "Reverse DNS Tool", icon: RotateCcw },
      { href: "/dashboard/network-tools/dns-propagation", key: "dnsPropagation", label: "DNS Propagation Checker", icon: Waypoints },
      { href: "/dashboard/network-tools/mtr", key: "mtr", label: "MTR Tool", icon: Activity },
    ],
  },
  {
    key: "auditWebsites",
    label: "Audit Websites & SSL Certificates",
    icon: Globe2,
    items: [
      { href: "/dashboard/audit/websites", key: "websites", label: "Websites", icon: Globe },
      { href: "/dashboard/audit/health-check", key: "healthCheck", label: "Website Health Check", icon: HeartPulse },
      { href: "/dashboard/audit/ssl-checker", key: "sslChecker", label: "SSL/TLS Certificate Checker", icon: Lock },
      { href: "/dashboard/audit/header-viewer", key: "headerViewer", label: "HTTP / HTTPS Response Header Viewer", icon: FileCode },
      { href: "/dashboard/audit/ga-tag-finder", key: "gaTagFinder", label: "GA Tag Finder", icon: BarChart3 },
    ],
  },
  {
    key: "emailDelivery",
    label: "Test Email Delivery",
    icon: Mail,
    items: [
      { href: "/dashboard/email-test/mx-test", key: "mxTest", label: "MX Mail Server Test", icon: Mail },
      { href: "/dashboard/email-test/smtp-test", key: "smtpTest", label: "SMTP Server Test", icon: Send },
      { href: "/dashboard/email-test/spf-dkim-dmarc", key: "spfDkimDmarc", label: "SPF, DKIM & DMARC Checker", icon: ShieldCheck },
      { href: "/dashboard/email-test/delivery-test", key: "deliveryTest", label: "Email Delivery Test", icon: MailCheck },
      { href: "/dashboard/email-test/dnsbl-lookup", key: "dnsblLookup", label: "DNSBL Spam Database Lookup", icon: Ban },
      { href: "/dashboard/email-test/uribl-lookup", key: "uriblLookup", label: "URIBL Spam Database Lookup", icon: Ban },
    ],
  },
  {
    key: "speedTest",
    label: "Speed Test",
    icon: Gauge,
    items: [
      { href: "/dashboard/speed-test/history", key: "history", label: "Speed Test History", icon: History },
      { href: "/dashboard/speed-test/nepal", key: "nepal", label: "Nepal Server Speed Test", icon: Gauge },
      { href: "/dashboard/speed-test/international", key: "international", label: "International Server Speed Test", icon: Globe },
      { href: "/dashboard/speed-test/local-ip", key: "localIp", label: "Local IP Speed Test", icon: Network },
    ],
  },
  {
    key: "whatIsMyIp",
    label: "What Is My IP",
    icon: Fingerprint,
    items: [
      { href: "/dashboard/whatismyip/my-ip", key: "myIp", label: "What Is My IP", icon: Fingerprint },
      { href: "/dashboard/whatismyip/ip-lookup", key: "ipLookup", label: "IP Lookup", icon: Search },
      { href: "/dashboard/whatismyip/whois-lookup", key: "whoisLookup", label: "WHOIS Lookup", icon: BookOpen },
      { href: "/dashboard/whatismyip/blacklist-check", key: "blacklistCheck", label: "Blacklist Check", icon: ShieldAlert },
      { href: "/dashboard/whatismyip/ipv6-test", key: "ipv6Test", label: "IPv6 Test", icon: Binary },
      { href: "/dashboard/whatismyip/proxy-vpn-detection", key: "proxyVpnDetection", label: "Proxy / VPN Detection", icon: EyeOff },
    ],
  },
  {
    key: "endpointAgents",
    label: "Endpoint Agents",
    icon: Monitor,
    items: [
      { href: "/dashboard/endpoint-agents", key: "agentDashboard", label: "Agent Dashboard", icon: Monitor },
      { href: "/dashboard/endpoint-agents/download", key: "downloadAgent", label: "Download Agent", icon: Download },
      { href: "/dashboard/endpoint-agents/enroll", key: "enrollDevice", label: "Enroll Device", icon: KeyRound },
      { href: "/dashboard/endpoint-agents/audit-log", key: "screenshotAuditLog", label: "Screenshot Audit Log", icon: History },
    ],
  },
  {
    key: "servers",
    label: "Servers",
    icon: Server,
    items: [
      { href: "/dashboard/servers", key: "serverList", label: "Server List", icon: Server },
      { href: "/dashboard/servers/add", key: "addServer", label: "Add Server", icon: PlusCircle },
      { href: "/dashboard/servers/download", key: "downloadAgent", label: "Download Agent", icon: Download },
    ],
  },
  {
    key: "website",
    label: "Website",
    icon: Layers,
    items: [
      { href: "/dashboard/website/slider", key: "sliderManagement", label: "Slider Management", icon: ImageIcon },
      { href: "/dashboard/website/tickets", key: "supportTickets", label: "Support Tickets", icon: Ticket },
      { href: "/dashboard/website/contact-messages", key: "contactMessages", label: "Contact Messages", icon: Inbox },
    ],
  },
];

// Flat list of every route + its parent group label, for the header's global search.
// English fallback only — HeaderClient builds the translated version itself via
// useTranslations, since this static export can't be locale-aware.
export const SEARCH_INDEX: { href: string; label: string; group: string }[] = [
  ...TOP_ITEMS.map((i) => ({ href: i.href, label: i.label, group: "Main" })),
  ...NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, group: g.label }))),
];
