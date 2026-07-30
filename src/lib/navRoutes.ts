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
  GitBranch,
  PlusCircle,
  Workflow,
  MessageCircle,
  Camera,
  Bell,
  FlaskConical,
  ClipboardCheck,
  FolderTree,
  ListChecks,
  PlayCircle,
  Zap,
  Bug,
  MonitorPlay,
  BarChart2,
  Rocket,
  FileText,
  ClipboardList,
  Flag,
  Cloud,
  Package,
  Biohazard,
  Shield,
  Terminal,
  Siren,
  Code2,
  FolderKanban,
  ScanLine,
  SearchCheck,
  AlertCircle,
  SlidersHorizontal,
  Database,
  Sparkles,
  Cog,
  FileLock2,
  KeySquare,
  Hash,
  QrCode,
  Key,
  Timer,
  Regex,
  Braces,
  Calculator,
  Divide,
  Link2,
  Clock3,
  Brain,
  Crosshair,
  GitMerge,
  FileSearch,
  ListTree,
  ShieldQuestion,
  Eye,
  Usb,
  Plug,
  ShieldOff,
  FileClock,
  Files,
  MailX,
  Flame,
  LayoutGrid,
  Bot,
  Boxes,
  type LucideIcon,
} from "lucide-react";

// `key` is the translation lookup (see messages/<locale>.json under "sidebar") — `label`
// stays as the English fallback/default and is what non-i18n-aware code (SEARCH_INDEX
// consumers building it without translations available) falls back to.
//
// Three-level nav model: NAV_CATEGORIES (fixed, curated groupings by function - not
// user-reorderable, that's the whole point of this reorganization) > NavEntry, which is
// either a direct NavLink or a NavSubGroup (a collapsible module with its own NavLink[] -
// what used to be a flat NAV_GROUPS entry, now nested one level deeper under its category).
export interface NavLink {
  type: "link";
  href: string;
  key: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSubGroup {
  type: "group";
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavLink[];
}

export type NavEntry = NavLink | NavSubGroup;

export interface NavCategory {
  key: string;
  label: string;
  items: NavEntry[];
}

function link(href: string, key: string, label: string, icon: LucideIcon): NavLink {
  return { type: "link", href, key, label, icon };
}

function group(key: string, label: string, icon: LucideIcon, items: NavLink[]): NavSubGroup {
  return { type: "group", key, label, icon, items };
}

export const NAV_CATEGORIES: NavCategory[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    items: [
      link("/dashboard", "overview", "Overview", LayoutDashboard),
      link("/dashboard/ai-assistant", "aiAssistant", "AI Assistant", Sparkles),
      group("aiModules", "AI Modules", Brain, [
        link("/dashboard/root-cause-analysis", "rootCauseAnalysis", "Root Cause Analysis", Crosshair),
        link("/dashboard/alert-correlation", "alertCorrelation", "Alert Correlation", GitMerge),
        link("/dashboard/ai-incident-summary", "aiIncidentSummary", "AI Incident Summary", FileSearch),
        link("/dashboard/ai-log-analyzer", "aiLogAnalyzer", "AI Log Analyzer", ListTree),
        link("/dashboard/ai-configuration-review", "aiConfigurationReview", "AI Configuration Review", ShieldQuestion),
        link("/dashboard/ai-threat-detection", "aiThreatDetection", "AI Threat Detection", Eye),
      ]),
    ],
  },
  {
    key: "userManagement",
    label: "User Management",
    items: [
      link("/dashboard/staff", "staff", "Employees", Users),
      link("/dashboard/chat", "employeeChat", "Employee Chat", MessageCircle),
      link("/dashboard/notifications", "sendNotification", "Send Notification", Bell),
    ],
  },
  {
    key: "securityCenter",
    label: "Security Center",
    items: [
      link("/dashboard/security-center", "securityCenterDashboard", "Dashboard", LayoutDashboard),
      link("/dashboard/security-center/vulnerability-scanner", "vulnerabilityScanner", "Vulnerability Scanner", Crosshair),
      link("/dashboard/security-center/waf", "waf", "Web Application Firewall", Shield),
      link("/dashboard/cameras", "cameras", "Cameras", Camera),
      group("endpointAgents", "Endpoint Agents", Monitor, [
        link("/dashboard/endpoint-agents", "agentDashboard", "Agent Dashboard", Monitor),
        link("/dashboard/endpoint-agents/download", "downloadAgent", "Download Agent", Download),
        link("/dashboard/endpoint-agents/enroll", "enrollDevice", "Enroll Device", KeyRound),
        link("/dashboard/endpoint-agents/audit-log", "screenshotAuditLog", "Screenshot Audit Log", History),
      ]),
      link("/dashboard/security", "intrusionDetection", "Intrusion Detection", Siren),
      link("/dashboard/ddos-detection", "ddosDetection", "DDos Detection", Flame),
      link("/dashboard/threat-scanner", "threatScanner", "Threat Scanner", Biohazard),
      link("/dashboard/malware-detection", "malwareDetection", "Malware Detection", Bug),
      group("fileIntegrityMonitoring", "File Integrity Monitoring", FileClock, [
        link("/dashboard/file-integrity/watched-files", "watchedFiles", "Watched Files", Files),
        link("/dashboard/file-integrity/history", "fileIntegrityHistory", "Change History", History),
      ]),
      group("usbDeviceControl", "USB Device Control", Usb, [
        link("/dashboard/usb-control/connected", "usbConnected", "Connected USB", Plug),
        link("/dashboard/usb-control/history", "usbHistory", "History", History),
        link("/dashboard/usb-control/block", "usbBlock", "Block", ShieldOff),
        link("/dashboard/usb-control/allow", "usbAllow", "Allow", ShieldCheck),
      ]),
      group("compliance", "Compliance", ShieldCheck, [
        link("/dashboard/compliance", "complianceDashboard", "Dashboard", LayoutDashboard),
        link("/dashboard/compliance/iso27001", "complianceIso27001", "ISO 27001", ClipboardCheck),
        link("/dashboard/compliance/pcidss", "compliancePciDss", "PCI DSS", ClipboardCheck),
        link("/dashboard/compliance/hipaa", "complianceHipaa", "HIPAA", ClipboardCheck),
        link("/dashboard/compliance/nist", "complianceNist", "NIST", ClipboardCheck),
        link("/dashboard/compliance/soc2", "complianceSoc2", "SOC 2", ClipboardCheck),
      ]),
    ],
  },
  {
    key: "networkManagement",
    label: "Network Management",
    items: [
      group("mikrotikRouter", "Mikrotik Router", Router, [
        link("/dashboard/router-clients", "routerClients", "Router Clients", Laptop2),
        link("/dashboard/router-health", "routerHealth", "Router Health", HeartPulse),
        link("/dashboard/router-web", "routerWeb", "Router Web Connections", Globe),
        link("/dashboard/staff/web-activity", "employeeWebActivity", "Employee Web Activity", Activity),
      ]),
      group("sophosFirewall", "Sophos Firewall", ShieldCheck, [
        link("/dashboard/sophos-clients", "sophosClients", "Sophos Clients", Wifi),
        link("/dashboard/web-filter", "webFilter", "Sophos Web Filter", Filter),
        link("/dashboard/system-health", "systemHealth", "Sophos System Health", Activity),
        link("/dashboard/sophos-events", "sophosEvents", "Sophos Events", ScrollText),
        link("/dashboard/top-consumers", "topConsumers", "Top Consumers", BarChart3),
      ]),
      group("servers", "Servers", Server, [
        link("/dashboard/servers", "serverList", "Server List", Server),
        link("/dashboard/servers/add", "addServer", "Add Server", PlusCircle),
        link("/dashboard/servers/download", "downloadAgent", "Download Agent", Download),
      ]),
      group("networkTools", "Network Tools", Wrench, [
        link("/dashboard/network-tools/ping", "ping", "Ping", Radar),
        link("/dashboard/network-tools/traceroute", "traceroute", "Traceroute", RouteIcon),
        link("/dashboard/network-tools/host", "host", "Host", Server),
        link("/dashboard/network-tools/dns-check", "dnsCheck", "DNS Check", Search),
        link("/dashboard/network-tools/nslookup", "nslookup", "Nslookup", SearchCode),
        link("/dashboard/network-tools/ntp-test", "ntpTest", "NTP Server Test", Clock),
        link("/dashboard/network-tools/reverse-dns", "reverseDns", "Reverse DNS Tool", RotateCcw),
        link("/dashboard/network-tools/dns-propagation", "dnsPropagation", "DNS Propagation Checker", Waypoints),
        link("/dashboard/network-tools/mtr", "mtr", "MTR Tool", Activity),
        link("/dashboard/network-tools/port-scanner", "portScanner", "Port Scanner", ScanLine),
      ]),
      group("networkDiagram", "Network Diagram", Workflow, [
        link("/dashboard/network-diagram/designs", "existingDiagrams", "Existing Diagrams", Waypoints),
        link("/dashboard/network-diagram/designs/new", "designNewDiagram", "Design New Diagram", PlusCircle),
      ]),
      link("/dashboard/sql-monitoring", "sqlServerMonitoring", "SQL Server Monitoring", Database),
      link("/dashboard/remote-support", "remoteSupport", "Remote Support", MonitorPlay),
      group("mailProtection", "Mail Protection", MailX, [
        link("/dashboard/mail-security/policies", "mailPolicies", "File Blocking Policies", FileLock2),
        link("/dashboard/mail-security/exceptions", "mailExceptions", "Exceptions", ShieldQuestion),
        link("/dashboard/mail-security/incidents", "mailIncidents", "Incidents", Siren),
        link("/dashboard/mail-security/templates", "mailTemplates", "Notification Templates", FileText),
        link("/dashboard/mail-security/connectors", "mailConnectors", "Mail Connectors", Plug),
        link("/dashboard/mail-security/reports", "mailReports", "Reports", BarChart2),
      ]),
    ],
  },
  {
    key: "remoteAccess",
    label: "Remote Access",
    items: [
      link("/dashboard/remote-access", "overview", "Overview", LayoutDashboard),
      link("/dashboard/remote-access/connections", "connections", "Connections", Network),
      link("/dashboard/remote-access/quick-connect", "quickConnect", "Quick Connect", Zap),
      link("/dashboard/remote-access/sessions", "activeSessions", "Active Sessions", Activity),
      link("/dashboard/remote-access/remote-desktop", "remoteDesktop", "Remote Desktop", MonitorPlay),
      link("/dashboard/remote-access/terminal", "terminal", "Terminal", Code2),
      link("/dashboard/remote-access/file-transfer", "fileTransfer", "File Transfer", FolderKanban),
      link("/dashboard/remote-access/inventory", "serverInventory", "Server Inventory", Server),
      link("/dashboard/remote-access/credentials", "credentialsVault", "Credentials Vault", Lock),
      link("/dashboard/remote-access/ssh-keys", "sshKeys", "SSH Keys", KeySquare),
      link("/dashboard/remote-access/port-forwarding", "portForwarding", "Port Forwarding", Waypoints),
      link("/dashboard/remote-access/scripts", "scriptsAndCommands", "Scripts & Commands", Code2),
      link("/dashboard/remote-access/logs", "connectionLogs", "Connection Logs", ScrollText),
      link("/dashboard/remote-access/settings", "settings", "Settings", Settings),
    ],
  },
  {
    key: "itAssetLogsheet",
    label: "IT Asset Logsheet",
    items: [
      link("/dashboard/it-assets", "dashboard", "Dashboard", LayoutDashboard),
      link("/dashboard/it-assets/assets", "assetRegister", "Asset Register", ClipboardList),
      link("/dashboard/it-assets/password-changes", "passwordChanges", "Password Changes", KeyRound),
      link("/dashboard/it-assets/patches", "patchesAndUpdates", "Patches and Updates", Wrench),
      link("/dashboard/it-assets/software", "softwareInventory", "Software Inventory", Package),
      link("/dashboard/it-assets/maintenance", "maintenanceLog", "Maintenance Log", Cog),
      link("/dashboard/it-assets/reports", "reports", "Reports", BarChart3),
      link("/dashboard/it-assets/alerts", "alerts", "Alerts", Bell),
      link("/dashboard/it-assets/settings", "settings", "Settings", Settings),
      link("/dashboard/it-assets/audit-log", "auditLog", "Audit Log", ScrollText),
    ],
  },
  {
    key: "browserActivity",
    label: "Browser Activity Audit",
    items: [
      link("/dashboard/browser-activity", "dashboard", "Dashboard", LayoutDashboard),
      link("/dashboard/browser-activity/events", "activityEvents", "Activity Events", Activity),
      link("/dashboard/browser-activity/security-alerts", "securityAlerts", "Security Alerts", Siren),
      link("/dashboard/browser-activity/categories", "domainCategories", "Domain Categories", Layers),
      link("/dashboard/browser-activity/excluded-domains", "excludedDomains", "Excluded Domains", ShieldOff),
      link("/dashboard/browser-activity/audit-log", "auditLog", "Audit Log", ScrollText),
      link("/dashboard/browser-activity/settings", "settings", "Settings", Settings),
      link("/dashboard/browser-activity/policy", "monitoringPolicy", "Monitoring Policy", ClipboardCheck),
    ],
  },
  {
    key: "websiteManagement",
    label: "Website Management",
    items: [
      link("/dashboard/audit/websites", "websites", "Websites", Globe),
      group("websiteSslAudit", "Website & SSL Audit", Globe2, [
        link("/dashboard/audit/health-check", "healthCheck", "Website Health Check", HeartPulse),
        link("/dashboard/audit/ssl-checker", "sslChecker", "SSL/TLS Certificate Checker", Lock),
        link("/dashboard/audit/header-viewer", "headerViewer", "HTTP / HTTPS Response Header Viewer", FileCode),
        link("/dashboard/audit/security-headers", "securityHeaders", "Security Headers", Shield),
        link("/dashboard/audit/ga-tag-finder", "gaTagFinder", "GA Tag Finder", BarChart3),
        link("/dashboard/audit/website-security", "websiteSecurityAudit", "Website Security Audit", ShieldAlert),
        link("/dashboard/audit/wordpress-scan", "wordpressScan", "WordPress Deep Scan", Terminal),
      ]),
      group("laravelSecurity", "Laravel Security", ShieldAlert, [
        link("/dashboard/laravel-security", "laravelSecurityDashboard", "Dashboard", LayoutDashboard),
        link("/dashboard/laravel-security/projects", "laravelSecurityProjects", "Projects", FolderKanban),
        link("/dashboard/laravel-security/scans", "laravelSecurityScans", "Scans", ScanLine),
        link("/dashboard/laravel-security/issues", "laravelSecurityIssues", "Issues", AlertCircle),
        link("/dashboard/laravel-security/settings", "laravelSecurityRulesSettings", "Rules and Settings", SlidersHorizontal),
      ]),
      group("codeQuality", "Code Quality", Code2, [
        link("/dashboard/code-quality", "codeQualityDashboard", "Dashboard", LayoutDashboard),
        link("/dashboard/code-quality/projects", "codeQualityProjects", "Projects", FolderKanban),
        link("/dashboard/code-quality/scans", "codeQualityScans", "Scans", ScanLine),
        link("/dashboard/code-quality/issues", "codeQualityIssues", "Issues", AlertCircle),
        link("/dashboard/code-quality/settings", "codeQualityRulesSettings", "Rules and Settings", SlidersHorizontal),
      ]),
      link("/dashboard/audit/website-performance", "websitePerformance", "Website Speed & Performance", Gauge),
      link("/dashboard/seo-scanner", "seoScanner", "SEO Scanner", SearchCheck),
      group("qaTesting", "QA Testing", FlaskConical, [
        link("/dashboard/qa", "qaDashboard", "QA Dashboard", ClipboardCheck),
        link("/dashboard/qa/requirements", "requirements", "Requirements", FileText),
        link("/dashboard/qa/test-suites", "testSuites", "Test Suites", FolderTree),
        link("/dashboard/qa/test-cases", "testCases", "Test Cases", ListChecks),
        link("/dashboard/qa/test-plans", "testPlans", "Test Plans", ClipboardList),
        link("/dashboard/qa/milestones", "milestones", "Milestones", Flag),
        link("/dashboard/qa/test-runs", "testRuns", "Test Runs", PlayCircle),
        link("/dashboard/qa/execute", "executeTest", "Execute Test", Zap),
        link("/dashboard/qa/bugs", "bugs", "Bugs", Bug),
        link("/dashboard/qa/releases", "releases", "Releases", Rocket),
        link("/dashboard/qa/environments", "environments", "Environments", Cloud),
        link("/dashboard/qa/builds", "builds", "Builds", Package),
        link("/dashboard/qa/reports", "reports", "QA Reports", BarChart2),
      ]),
      group("speedTest", "Speed Test", Gauge, [
        link("/dashboard/speed-test/history", "history", "Speed Test History", History),
        link("/dashboard/speed-test/nepal", "nepal", "Nepal Server Speed Test", Gauge),
        link("/dashboard/speed-test/international", "international", "International Server Speed Test", Globe),
        link("/dashboard/speed-test/local-ip", "localIp", "Local IP Speed Test", Network),
      ]),
      group("emailDelivery", "Test Email Delivery", Mail, [
        link("/dashboard/email-test/mx-test", "mxTest", "MX Mail Server Test", Mail),
        link("/dashboard/email-test/smtp-test", "smtpTest", "SMTP Server Test", Send),
        link("/dashboard/email-test/spf-dkim-dmarc", "spfDkimDmarc", "SPF, DKIM & DMARC Checker", ShieldCheck),
        link("/dashboard/email-test/delivery-test", "deliveryTest", "Email Delivery Test", MailCheck),
        link("/dashboard/email-test/dnsbl-lookup", "dnsblLookup", "DNSBL Spam Database Lookup", Ban),
        link("/dashboard/email-test/uribl-lookup", "uriblLookup", "URIBL Spam Database Lookup", Ban),
      ]),
      group("whatIsMyIp", "What Is My IP", Fingerprint, [
        link("/dashboard/whatismyip/my-ip", "myIp", "What Is My IP", Fingerprint),
        link("/dashboard/whatismyip/ip-lookup", "ipLookup", "IP Lookup", Search),
        link("/dashboard/whatismyip/whois-lookup", "whoisLookup", "WHOIS Lookup", BookOpen),
        link("/dashboard/whatismyip/blacklist-check", "blacklistCheck", "Blacklist Check", ShieldAlert),
        link("/dashboard/whatismyip/ipv6-test", "ipv6Test", "IPv6 Test", Binary),
        link("/dashboard/whatismyip/proxy-vpn-detection", "proxyVpnDetection", "Proxy / VPN Detection", EyeOff),
      ]),
    ],
  },
  {
    key: "websiteApiMonitoring",
    label: "Website & API Monitoring",
    items: [
      link("/dashboard/monitoring", "overview", "Overview", Activity),
      link("/dashboard/monitoring/websites", "websiteMonitors", "Website Monitors", Globe2),
      link("/dashboard/monitoring/api", "apiMonitors", "API Monitors", Workflow),
      link("/dashboard/monitoring/incidents", "incidents", "Incidents", Siren),
      link("/dashboard/monitoring/ssl-certificates", "sslCertificates", "SSL Certificates", Lock),
      link("/dashboard/monitoring/alert-contacts", "alertContacts", "Alert Contacts", Bell),
      link("/dashboard/monitoring/alert-policies", "alertPolicies", "Alert Policies", Layers),
      link("/dashboard/monitoring/maintenance", "maintenanceWindows", "Maintenance Windows", Wrench),
      link("/dashboard/monitoring/reports", "reports", "Reports", BarChart2),
      link("/dashboard/monitoring/notification-logs", "notificationLogs", "Notification Logs", ScrollText),
      link("/dashboard/monitoring/settings", "settings", "Settings", Settings),
    ],
  },
  {
    key: "automation",
    label: "Automation",
    items: [
      link("/dashboard/automation/scripts", "scripts", "Scripts", Terminal),
      link("/dashboard/automation/tasks", "remoteTasks", "Remote Tasks", PlayCircle),
      link("/dashboard/automation/schedules", "scheduledJobs", "Scheduled Jobs", Timer),
    ],
  },
  {
    key: "administration",
    label: "Administration",
    items: [
      group("website", "Website", Layers, [
        link("/dashboard/website/slider", "sliderManagement", "Slider Management", ImageIcon),
        link("/dashboard/website/tickets", "supportTickets", "Support Tickets", Ticket),
        link("/dashboard/website/contact-messages", "contactMessages", "Contact Messages", Inbox),
      ]),
      link("/dashboard/settings/integrations/git", "gitConnections", "Integrations", GitBranch),
      link("/dashboard/settings", "companySettings", "Company Settings", Settings),
      group("utilities", "Utilities", Cog, [
        link("/dashboard/utilities/ssl-decoder", "sslDecoder", "SSL Decoder", FileLock2),
        link("/dashboard/utilities/jwt-decoder", "jwtDecoder", "JWT Decoder", KeySquare),
        link("/dashboard/utilities/base64-tool", "base64Tool", "Base64 Tool", Binary),
        link("/dashboard/utilities/hash-generator", "hashGenerator", "Hash Generator", Hash),
        link("/dashboard/utilities/qr-code-generator", "qrCodeGenerator", "QR Code Generator", QrCode),
        link("/dashboard/utilities/password-generator", "passwordGenerator", "Password Generator", Key),
        link("/dashboard/utilities/cron-tester", "cronTester", "Cron Expression Tester", Timer),
        link("/dashboard/utilities/regex-tester", "regexTester", "Regex Tester", Regex),
        link("/dashboard/utilities/json-formatter", "jsonFormatter", "JSON Formatter", Braces),
        link("/dashboard/utilities/yaml-validator", "yamlValidator", "YAML Validator", FileCode),
        link("/dashboard/utilities/xml-validator", "xmlValidator", "XML Validator", FileText),
        link("/dashboard/utilities/cidr-calculator", "cidrCalculator", "CIDR Calculator", Calculator),
        link("/dashboard/utilities/subnet-calculator", "subnetCalculator", "Subnet Calculator", Divide),
        link("/dashboard/utilities/url-encoder-decoder", "urlEncoderDecoder", "URL Encoder/Decoder", Link2),
        link("/dashboard/utilities/timezone-converter", "timezoneConverter", "Time Zone Converter", Clock3),
      ]),
    ],
  },
];

// Permission-gated subgroup keys - resolved server-side in DashboardLayout and threaded
// down through SidebarShell -> Sidebar as boolean props, same convention as before the
// category reorganization (qaTesting/codeQuality/laravelSecurity/mailProtection).
export const GATED_GROUP_KEYS = {
  qaTesting: "qa_view",
  codeQuality: "cq_view",
  laravelSecurity: "ls_view",
  mailProtection: "mail_view",
} as const;

// Unlike GATED_GROUP_KEYS (a subgroup nested inside an always-visible category), Website &
// API Monitoring is gated at the whole-category level - the category has no ungated entries
// to fall back to, so it must disappear entirely for a user without mon_view.
export const GATED_CATEGORY_KEYS = {
  websiteApiMonitoring: "mon_view",
  automation: "auto_view",
  remoteAccess: "ra_view",
  itAssetLogsheet: "ita_view",
  browserActivity: "ba_view",
} as const;

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutGrid,
  userManagement: Users,
  securityCenter: ShieldAlert,
  networkManagement: Network,
  remoteAccess: Terminal,
  itAssetLogsheet: Boxes,
  browserActivity: History,
  websiteManagement: Globe2,
  websiteApiMonitoring: Activity,
  automation: Bot,
  administration: Cog,
};

// Flat list of every route + its immediate parent label, for the header's global search.
// English fallback only — HeaderClient builds the translated version itself via
// useTranslations, since this static export can't be locale-aware.
export const SEARCH_INDEX: { href: string; label: string; group: string }[] = NAV_CATEGORIES.flatMap((category) =>
  category.items.flatMap((entry) =>
    entry.type === "link" ? [{ href: entry.href, label: entry.label, group: category.label }] : entry.items.map((item) => ({ href: item.href, label: item.label, group: entry.label }))
  )
);
