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

// Ordered in correlated clusters rather than build order: core/overview, then people &
// communication (who's on the network and how to reach/see them), then the three standalone
// threat-detection modules together, then website-facing tools, then admin/settings last.
export const TOP_ITEMS: NavItem[] = [
  { href: "/dashboard", key: "overview", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/ai-assistant", key: "aiAssistant", label: "AI Assistant", icon: Sparkles },

  { href: "/dashboard/staff", key: "staff", label: "Employees", icon: Users },
  { href: "/dashboard/chat", key: "employeeChat", label: "Employee Chat", icon: MessageCircle },
  { href: "/dashboard/cameras", key: "cameras", label: "Cameras", icon: Camera },
  // Access itself is enforced per-request by requireRemoteSupportPermission.ts (remote_support_request
  // + the caller's own MFA) - this entry is always visible, same as most other modules; the page
  // shows an access-denied message rather than hiding the nav item for users without the grant.
  { href: "/dashboard/remote-support", key: "remoteSupport", label: "Remote Support", icon: MonitorPlay },

  { href: "/dashboard/security", key: "intrusionDetection", label: "Intrusion Detection", icon: Siren },
  { href: "/dashboard/threat-scanner", key: "threatScanner", label: "Threat Scanner", icon: Biohazard },
  { href: "/dashboard/malware-detection", key: "malwareDetection", label: "Malware Detection", icon: Bug },

  { href: "/dashboard/audit/website-performance", key: "websitePerformance", label: "Website Speed & Performance", icon: Gauge },
  { href: "/dashboard/seo-scanner", key: "seoScanner", label: "SEO Scanner", icon: SearchCheck },

  { href: "/dashboard/notifications", key: "sendNotification", label: "Send Notification", icon: Bell },
  { href: "/dashboard/settings", key: "companySettings", label: "Company Settings", icon: Settings },
  { href: "/dashboard/settings/integrations/git", key: "gitConnections", label: "Integration", icon: GitBranch },
];

// Groups are ordered in correlated clusters, not build order: Security & Threat Detection
// first (every module that watches for or responds to an attack/policy violation), then
// Network Infrastructure & Monitoring, then Website & Web Presence, then Email, then
// Dev/QA Tooling last. Within each cluster, groups that share the same underlying data
// source or workflow sit next to each other (e.g. Sophos Firewall right next to DDoS
// Detection, which is a focused view over the same Intrusion Detection event/alert data).
export const NAV_GROUPS: NavGroup[] = [
  // --- Security & Threat Detection ---------------------------------------------------------
  {
    key: "sophosFirewall",
    label: "Sophos Firewall",
    icon: ShieldCheck,
    items: [
      { href: "/dashboard/sophos-clients", key: "sophosClients", label: "Sophos Clients", icon: Wifi },
      { href: "/dashboard/web-filter", key: "webFilter", label: "Sophos Web Filter", icon: Filter },
      { href: "/dashboard/system-health", key: "systemHealth", label: "Sophos System Health", icon: Activity },
      { href: "/dashboard/sophos-events", key: "sophosEvents", label: "Sophos Events", icon: ScrollText },
      { href: "/dashboard/top-consumers", key: "topConsumers", label: "Top Consumers", icon: BarChart3 },
    ],
  },
  // A focused view over Intrusion Detection's own SecurityEvents/SecurityAlerts data (the
  // high_request_rate/bot_activity categories + SecurityIpBlocklist) rather than a separate
  // collection pipeline - see the summary API route's own header comment for why.
  {
    key: "ddosDetection",
    label: "DDoS Detection",
    icon: Flame,
    items: [{ href: "/dashboard/ddos-detection", key: "ddosDetectionDashboard", label: "DDoS Detection", icon: Flame }],
  },
  {
    key: "usbDeviceControl",
    label: "USB Device Control",
    icon: Usb,
    items: [
      { href: "/dashboard/usb-control/connected", key: "usbConnected", label: "Connected USB", icon: Plug },
      { href: "/dashboard/usb-control/history", key: "usbHistory", label: "History", icon: History },
      { href: "/dashboard/usb-control/block", key: "usbBlock", label: "Block", icon: ShieldOff },
      { href: "/dashboard/usb-control/allow", key: "usbAllow", label: "Allow", icon: ShieldCheck },
    ],
  },
  {
    key: "fileIntegrityMonitoring",
    label: "File Integrity Monitoring",
    icon: FileClock,
    items: [
      { href: "/dashboard/file-integrity/watched-files", key: "watchedFiles", label: "Watched Files", icon: Files },
      { href: "/dashboard/file-integrity/history", key: "fileIntegrityHistory", label: "Change History", icon: History },
    ],
  },
  // Visibility of this group alone is gated by mail_view - see getMailAccess() in
  // requireMailPolicyPermission.ts, same pattern qaAccess/codeQualityAccess/laravelSecurityAccess
  // already established. Stage 1: policy engine + Test Policy simulator only, no live mail
  // provider connected yet - see docs/mail-security.md if one gets written for Stage 2 context.
  {
    key: "mailProtection",
    label: "Mail Protection",
    icon: MailX,
    items: [
      { href: "/dashboard/mail-security/policies", key: "mailPolicies", label: "File Blocking Policies", icon: FileLock2 },
      { href: "/dashboard/mail-security/exceptions", key: "mailExceptions", label: "Exceptions", icon: ShieldQuestion },
      { href: "/dashboard/mail-security/incidents", key: "mailIncidents", label: "Incidents", icon: Siren },
      { href: "/dashboard/mail-security/templates", key: "mailTemplates", label: "Notification Templates", icon: FileText },
      { href: "/dashboard/mail-security/connectors", key: "mailConnectors", label: "Mail Connectors", icon: Plug },
      { href: "/dashboard/mail-security/reports", key: "mailReports", label: "Reports", icon: BarChart2 },
    ],
  },
  // Standalone module (own sidebar section, not a Code Quality category - see the user's
  // explicit choice on this). Visibility gated by ls_view - see getLsAccess() in
  // requireLaravelSecurityPermission.ts and the laravelSecurityAccess prop threaded through
  // DashboardLayout -> SidebarShell -> Sidebar (same pattern codeQualityAccess established).
  {
    key: "laravelSecurity",
    label: "Laravel Security",
    icon: ShieldAlert,
    items: [
      { href: "/dashboard/laravel-security", key: "laravelSecurityDashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/laravel-security/projects", key: "laravelSecurityProjects", label: "Projects", icon: FolderKanban },
      { href: "/dashboard/laravel-security/scans", key: "laravelSecurityScans", label: "Scans", icon: ScanLine },
      { href: "/dashboard/laravel-security/issues", key: "laravelSecurityIssues", label: "Issues", icon: AlertCircle },
      { href: "/dashboard/laravel-security/settings", key: "laravelSecurityRulesSettings", label: "Rules and Settings", icon: SlidersHorizontal },
    ],
  },
  {
    key: "compliance",
    label: "Compliance",
    icon: ShieldCheck,
    items: [
      { href: "/dashboard/compliance", key: "complianceDashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/compliance/iso27001", key: "complianceIso27001", label: "ISO 27001", icon: ClipboardCheck },
      { href: "/dashboard/compliance/pcidss", key: "compliancePciDss", label: "PCI DSS", icon: ClipboardCheck },
      { href: "/dashboard/compliance/hipaa", key: "complianceHipaa", label: "HIPAA", icon: ClipboardCheck },
      { href: "/dashboard/compliance/nist", key: "complianceNist", label: "NIST", icon: ClipboardCheck },
      { href: "/dashboard/compliance/soc2", key: "complianceSoc2", label: "SOC 2", icon: ClipboardCheck },
    ],
  },
  // The AI-driven analysis layer sits last in this cluster - it reasons ACROSS the other
  // security modules' data (intrusion alerts, Sophos threats, malware findings, etc.) rather
  // than being its own data source, so it reads naturally as the capstone of the cluster.
  {
    key: "aiModules",
    label: "AI Modules",
    icon: Brain,
    items: [
      { href: "/dashboard/root-cause-analysis", key: "rootCauseAnalysis", label: "Root Cause Analysis", icon: Crosshair },
      { href: "/dashboard/alert-correlation", key: "alertCorrelation", label: "Alert Correlation", icon: GitMerge },
      { href: "/dashboard/ai-incident-summary", key: "aiIncidentSummary", label: "AI Incident Summary", icon: FileSearch },
      { href: "/dashboard/ai-log-analyzer", key: "aiLogAnalyzer", label: "AI Log Analyzer", icon: ListTree },
      { href: "/dashboard/ai-configuration-review", key: "aiConfigurationReview", label: "AI Configuration Review", icon: ShieldQuestion },
      { href: "/dashboard/ai-threat-detection", key: "aiThreatDetection", label: "AI Threat Detection", icon: Eye },
    ],
  },

  // --- Network Infrastructure & Monitoring -------------------------------------------------
  {
    key: "mikrotikRouter",
    label: "Mikrotik Router",
    icon: Router,
    items: [
      { href: "/dashboard/router-clients", key: "routerClients", label: "Router Clients", icon: Laptop2 },
      { href: "/dashboard/router-health", key: "routerHealth", label: "Router Health", icon: HeartPulse },
      { href: "/dashboard/router-web", key: "routerWeb", label: "Router Web Connections", icon: Globe },
      { href: "/dashboard/staff/web-activity", key: "employeeWebActivity", label: "Employee Web Activity", icon: Activity },
    ],
  },
  {
    key: "networkDiagram",
    label: "Network Diagram",
    icon: Workflow,
    items: [
      { href: "/dashboard/network-diagram/designs", key: "existingDiagrams", label: "Existing Diagrams", icon: Waypoints },
      { href: "/dashboard/network-diagram/designs/new", key: "designNewDiagram", label: "Design New Diagram", icon: PlusCircle },
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
      { href: "/dashboard/network-tools/port-scanner", key: "portScanner", label: "Port Scanner", icon: ScanLine },
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
    key: "sqlServerMonitoring",
    label: "SQL Server Monitoring",
    icon: Database,
    items: [{ href: "/dashboard/sql-monitoring", key: "sqlServerMonitoringList", label: "Instances", icon: Database }],
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

  // --- Website & Web Presence --------------------------------------------------------------
  {
    key: "auditWebsites",
    label: "Audit Websites & SSL Certificates",
    icon: Globe2,
    items: [
      { href: "/dashboard/audit/websites", key: "websites", label: "Websites", icon: Globe },
      { href: "/dashboard/audit/health-check", key: "healthCheck", label: "Website Health Check", icon: HeartPulse },
      { href: "/dashboard/audit/ssl-checker", key: "sslChecker", label: "SSL/TLS Certificate Checker", icon: Lock },
      { href: "/dashboard/audit/header-viewer", key: "headerViewer", label: "HTTP / HTTPS Response Header Viewer", icon: FileCode },
      { href: "/dashboard/audit/security-headers", key: "securityHeaders", label: "Security Headers", icon: Shield },
      { href: "/dashboard/audit/ga-tag-finder", key: "gaTagFinder", label: "GA Tag Finder", icon: BarChart3 },
      { href: "/dashboard/audit/website-security", key: "websiteSecurityAudit", label: "Website Security Audit", icon: ShieldAlert },
      { href: "/dashboard/audit/wordpress-scan", key: "wordpressScan", label: "WordPress Deep Scan", icon: Terminal },
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

  // --- Email ---------------------------------------------------------------------------------
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

  // --- Dev / QA Tooling ----------------------------------------------------------------------
  // Visibility of this group alone (not any other) is gated by qa_view — see canAccessQa()
  // in requireQaPermission.ts and the qaAccess prop threaded through
  // DashboardLayout -> SidebarShell -> Sidebar.
  {
    key: "qaTesting",
    label: "QA Testing",
    icon: FlaskConical,
    items: [
      { href: "/dashboard/qa", key: "qaDashboard", label: "QA Dashboard", icon: ClipboardCheck },
      { href: "/dashboard/qa/requirements", key: "requirements", label: "Requirements", icon: FileText },
      { href: "/dashboard/qa/test-suites", key: "testSuites", label: "Test Suites", icon: FolderTree },
      { href: "/dashboard/qa/test-cases", key: "testCases", label: "Test Cases", icon: ListChecks },
      { href: "/dashboard/qa/test-plans", key: "testPlans", label: "Test Plans", icon: ClipboardList },
      { href: "/dashboard/qa/milestones", key: "milestones", label: "Milestones", icon: Flag },
      { href: "/dashboard/qa/test-runs", key: "testRuns", label: "Test Runs", icon: PlayCircle },
      { href: "/dashboard/qa/execute", key: "executeTest", label: "Execute Test", icon: Zap },
      { href: "/dashboard/qa/bugs", key: "bugs", label: "Bugs", icon: Bug },
      { href: "/dashboard/qa/releases", key: "releases", label: "Releases", icon: Rocket },
      { href: "/dashboard/qa/environments", key: "environments", label: "Environments", icon: Cloud },
      { href: "/dashboard/qa/builds", key: "builds", label: "Builds", icon: Package },
      { href: "/dashboard/qa/reports", key: "reports", label: "QA Reports", icon: BarChart2 },
    ],
  },
  // Visibility of this group alone is gated by cq_view - see getCqAccess() in
  // requireCodeQualityPermission.ts and the codeQualityAccess prop threaded through
  // DashboardLayout -> SidebarShell -> Sidebar (same pattern qaAccess already established).
  {
    key: "codeQuality",
    label: "Code Quality",
    icon: Code2,
    items: [
      { href: "/dashboard/code-quality", key: "codeQualityDashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/code-quality/projects", key: "codeQualityProjects", label: "Projects", icon: FolderKanban },
      { href: "/dashboard/code-quality/scans", key: "codeQualityScans", label: "Scans", icon: ScanLine },
      { href: "/dashboard/code-quality/issues", key: "codeQualityIssues", label: "Issues", icon: AlertCircle },
      { href: "/dashboard/code-quality/settings", key: "codeQualityRulesSettings", label: "Rules and Settings", icon: SlidersHorizontal },
    ],
  },
  {
    key: "utilities",
    label: "Utilities",
    icon: Cog,
    items: [
      { href: "/dashboard/utilities/ssl-decoder", key: "sslDecoder", label: "SSL Decoder", icon: FileLock2 },
      { href: "/dashboard/utilities/jwt-decoder", key: "jwtDecoder", label: "JWT Decoder", icon: KeySquare },
      { href: "/dashboard/utilities/base64-tool", key: "base64Tool", label: "Base64 Tool", icon: Binary },
      { href: "/dashboard/utilities/hash-generator", key: "hashGenerator", label: "Hash Generator", icon: Hash },
      { href: "/dashboard/utilities/qr-code-generator", key: "qrCodeGenerator", label: "QR Code Generator", icon: QrCode },
      { href: "/dashboard/utilities/password-generator", key: "passwordGenerator", label: "Password Generator", icon: Key },
      { href: "/dashboard/utilities/cron-tester", key: "cronTester", label: "Cron Expression Tester", icon: Timer },
      { href: "/dashboard/utilities/regex-tester", key: "regexTester", label: "Regex Tester", icon: Regex },
      { href: "/dashboard/utilities/json-formatter", key: "jsonFormatter", label: "JSON Formatter", icon: Braces },
      { href: "/dashboard/utilities/yaml-validator", key: "yamlValidator", label: "YAML Validator", icon: FileCode },
      { href: "/dashboard/utilities/xml-validator", key: "xmlValidator", label: "XML Validator", icon: FileText },
      { href: "/dashboard/utilities/cidr-calculator", key: "cidrCalculator", label: "CIDR Calculator", icon: Calculator },
      { href: "/dashboard/utilities/subnet-calculator", key: "subnetCalculator", label: "Subnet Calculator", icon: Divide },
      { href: "/dashboard/utilities/url-encoder-decoder", key: "urlEncoderDecoder", label: "URL Encoder/Decoder", icon: Link2 },
      { href: "/dashboard/utilities/timezone-converter", key: "timezoneConverter", label: "Time Zone Converter", icon: Clock3 },
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
