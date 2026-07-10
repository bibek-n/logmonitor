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

// Placeholders where the real business detail isn't known yet — find/replace once
// provided (never invent real-looking facts).
export const CONTACT_INFO = {
  address: "[Company Address]",
  phone: "[Phone Number]",
  email: "support@websearchpro.net",
  hours: "[Business Hours]",
  mapEmbedUrl: null as string | null, // needs a real address before a map can be embedded
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
