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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const TOP_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
  { href: "/dashboard/settings", label: "Company Settings", icon: Settings },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Mikrotik Router",
    icon: Router,
    items: [
      { href: "/dashboard/router-clients", label: "Router Clients", icon: Laptop2 },
      { href: "/dashboard/router-health", label: "Router Health", icon: HeartPulse },
      { href: "/dashboard/router-logs", label: "Router Logs", icon: ScrollText },
      { href: "/dashboard/router-web", label: "Router Web Connections", icon: Globe },
    ],
  },
  {
    label: "Sophos Firewall",
    icon: ShieldCheck,
    items: [
      { href: "/dashboard/sophos-clients", label: "Sophos Clients", icon: Wifi },
      { href: "/dashboard/web-filter", label: "Sophos Web Filter", icon: Filter },
      { href: "/dashboard/system-health", label: "Sophos System Health", icon: Activity },
      { href: "/dashboard/sophos-events", label: "Sophos Events", icon: ScrollText },
    ],
  },
  {
    label: "Network Tools",
    icon: Wrench,
    items: [
      { href: "/dashboard/network-tools/ping", label: "Ping", icon: Radar },
      { href: "/dashboard/network-tools/traceroute", label: "Traceroute", icon: RouteIcon },
      { href: "/dashboard/network-tools/host", label: "Host", icon: Server },
      { href: "/dashboard/network-tools/dns-check", label: "DNS Check", icon: Search },
      { href: "/dashboard/network-tools/nslookup", label: "Nslookup", icon: SearchCode },
      { href: "/dashboard/network-tools/ntp-test", label: "NTP Server Test", icon: Clock },
      { href: "/dashboard/network-tools/reverse-dns", label: "Reverse DNS Tool", icon: RotateCcw },
      { href: "/dashboard/network-tools/dns-propagation", label: "DNS Propagation Checker", icon: Waypoints },
      { href: "/dashboard/network-tools/mtr", label: "MTR Tool", icon: Activity },
    ],
  },
  {
    label: "Audit Websites & SSL Certificates",
    icon: Globe2,
    items: [
      { href: "/dashboard/audit/websites", label: "Websites", icon: Globe },
      { href: "/dashboard/audit/health-check", label: "Website Health Check", icon: HeartPulse },
      { href: "/dashboard/audit/ssl-checker", label: "SSL/TLS Certificate Checker", icon: Lock },
      { href: "/dashboard/audit/header-viewer", label: "HTTP / HTTPS Response Header Viewer", icon: FileCode },
      { href: "/dashboard/audit/ga-tag-finder", label: "GA Tag Finder", icon: BarChart3 },
    ],
  },
  {
    label: "Test Email Delivery",
    icon: Mail,
    items: [
      { href: "/dashboard/email-test/mx-test", label: "MX Mail Server Test", icon: Mail },
      { href: "/dashboard/email-test/smtp-test", label: "SMTP Server Test", icon: Send },
      { href: "/dashboard/email-test/spf-dkim-dmarc", label: "SPF, DKIM & DMARC Checker", icon: ShieldCheck },
      { href: "/dashboard/email-test/delivery-test", label: "Email Delivery Test", icon: MailCheck },
      { href: "/dashboard/email-test/dnsbl-lookup", label: "DNSBL Spam Database Lookup", icon: Ban },
      { href: "/dashboard/email-test/uribl-lookup", label: "URIBL Spam Database Lookup", icon: Ban },
    ],
  },
  {
    label: "Speed Test",
    icon: Gauge,
    items: [
      { href: "/dashboard/speed-test/history", label: "Speed Test History", icon: History },
      { href: "/dashboard/speed-test/nepal", label: "Nepal Server Speed Test", icon: Gauge },
      { href: "/dashboard/speed-test/international", label: "International Server Speed Test", icon: Globe },
      { href: "/dashboard/speed-test/local-ip", label: "Local IP Speed Test", icon: Network },
    ],
  },
  {
    label: "What Is My IP",
    icon: Fingerprint,
    items: [
      { href: "/dashboard/whatismyip/my-ip", label: "What Is My IP", icon: Fingerprint },
      { href: "/dashboard/whatismyip/ip-lookup", label: "IP Lookup", icon: Search },
      { href: "/dashboard/whatismyip/whois-lookup", label: "WHOIS Lookup", icon: BookOpen },
      { href: "/dashboard/whatismyip/blacklist-check", label: "Blacklist Check", icon: ShieldAlert },
      { href: "/dashboard/whatismyip/ipv6-test", label: "IPv6 Test", icon: Binary },
      { href: "/dashboard/whatismyip/proxy-vpn-detection", label: "Proxy / VPN Detection", icon: EyeOff },
    ],
  },
  {
    label: "Endpoint Agents",
    icon: Monitor,
    items: [
      { href: "/dashboard/endpoint-agents", label: "Agent Dashboard", icon: Monitor },
      { href: "/dashboard/endpoint-agents/download", label: "Download Agent", icon: Download },
      { href: "/dashboard/endpoint-agents/enroll", label: "Enroll Device", icon: KeyRound },
      { href: "/dashboard/endpoint-agents/audit-log", label: "Screenshot Audit Log", icon: History },
    ],
  },
  {
    label: "Servers",
    icon: Server,
    items: [
      { href: "/dashboard/servers", label: "Server List", icon: Server },
      { href: "/dashboard/servers/add", label: "Add Server", icon: PlusCircle },
      { href: "/dashboard/servers/download", label: "Download Agent", icon: Download },
    ],
  },
  {
    label: "Website",
    icon: Layers,
    items: [
      { href: "/dashboard/website/slider", label: "Slider Management", icon: ImageIcon },
      { href: "/dashboard/website/tickets", label: "Support Tickets", icon: Ticket },
      { href: "/dashboard/website/contact-messages", label: "Contact Messages", icon: Inbox },
    ],
  },
];

// Flat list of every route + its parent group label, for the header's global search.
export const SEARCH_INDEX: { href: string; label: string; group: string }[] = [
  ...TOP_ITEMS.map((i) => ({ href: i.href, label: i.label, group: "Main" })),
  ...NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, group: g.label }))),
];
