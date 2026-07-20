// Structural, non-text public-site config — mirrors the pattern already used by
// src/lib/navRoutes.ts for the internal dashboard's own nav. All user-visible text now
// lives in messages/<locale>.json (see the i18n plan); this file only holds keys, hrefs,
// and icon names that don't get translated.

export interface NavItem {
  key: string;
  href: string;
}

export const PUBLIC_NAV: NavItem[] = [
  { key: "home", href: "/" },
  { key: "aboutSoftware", href: "/about-software" },
  { key: "aboutUs", href: "/about-us" },
  { key: "support", href: "/support" },
  { key: "supportTickets", href: "/support/tickets/new" },
  { key: "contact", href: "/contact" },
];

export const SERVICE_KEYS = ["security", "network", "hardware", "staff", "supportMgmt", "supportTickets"] as const;
export const SERVICE_ICONS: Record<(typeof SERVICE_KEYS)[number], string> = {
  security: "ShieldCheck",
  network: "Network",
  hardware: "HardDrive",
  staff: "Users",
  supportMgmt: "LifeBuoy",
  supportTickets: "Ticket",
};

export const ABOUT_SOFTWARE_FEATURE_KEYS = [
  "security",
  "network",
  "hardware",
  "staff",
  "alerts",
  "dashboard",
  "userRoles",
  "tickets",
  "audit",
  "auth",
] as const;

export const WHY_CHOOSE_US_KEYS = [
  "realtime",
  "secure",
  "easyDashboard",
  "fastSupport",
  "cloudReady",
  "scalable",
  "rbac",
  "autoReports",
  "dataProtection",
  "monitoring247",
] as const;
export const WHY_CHOOSE_US_ICONS: Record<(typeof WHY_CHOOSE_US_KEYS)[number], string> = {
  realtime: "Activity",
  secure: "Lock",
  easyDashboard: "LayoutDashboard",
  fastSupport: "Zap",
  cloudReady: "Cloud",
  scalable: "TrendingUp",
  rbac: "KeyRound",
  autoReports: "FileText",
  dataProtection: "ShieldCheck",
  monitoring247: "Clock",
};

export const ABOUT_US_MISSION_POINT_KEYS = ["0", "1", "2", "3", "4"] as const;

export const CONTACT_INFO = {
  address: "Tulips Technologies Pvt. Ltd., New Baneshwor, Kathmandu, Nepal",
  phone: "+977 01 4795677",
  email: "info@tulipstechnologies.com",
  hours: "Sun - Fri: 9:00 AM - 6:00 PM (Closed Saturday)",
  // Official Google Business listing embed for Tulips Technologies Pvt. Ltd. (Place ID-based).
  mapEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2755.476653339221!2d85.3342483!3d27.6895386!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39eb1995fda20031%3A0x3b4b0ee03aafcc6!2sTulips%20Technologies%20Pvt.%20Ltd.!5e1!3m2!1sen!2snp!4v1784010125486!5m2!1sen!2snp" as string | null,
};

export const FOOTER_LINKS = {
  quickLinks: [
    { key: "aboutUs", href: "/about-us" },
    { key: "services", href: "/services" },
    { key: "support", href: "/support" },
    { key: "supportTickets", href: "/support/tickets/new" },
  ],
  legal: [
    { key: "privacyPolicy", href: "/privacy-policy" },
    { key: "terms", href: "/terms" },
  ],
};

export const SUPPORT_GUIDE_KEYS = ["0", "1", "2"] as const;
export const SUPPORT_FAQ_KEYS = ["access", "report", "checkStatus", "consent"] as const;

export const TICKET_CATEGORY_KEYS = ["general", "technical", "billing", "feature", "bug", "other"] as const;
export const TICKET_PRIORITY_KEYS = ["low", "medium", "high", "urgent"] as const;
export const TICKET_STATUS_KEYS = ["open", "in_progress", "resolved", "closed"] as const;

// Canonical English labels stored in the DB regardless of the submitter's UI language —
// TicketForm always submits these (see CATEGORY_EN_LABELS/PRIORITY_EN_LABELS there), and
// this API-side validation list must keep matching them exactly.
export const TICKET_CATEGORIES = ["General Inquiry", "Technical Issue", "Billing", "Feature Request", "Bug Report", "Other"];
export const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
