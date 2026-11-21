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

export interface ContactInfo {
  address: string | null;
  phone: string | null;
  email: string | null;
  hours: string | null;
  // Not sourced from CompanySettings - a Google Maps embed URL is tied to one specific
  // physical address (originally baked in here as Tulips Technologies' own Place ID), and
  // there's no per-deployment field for a company's own embed yet. Always null until one
  // exists, rather than leaking a different company's own office onto someone else's page.
  mapEmbedUrl: string | null;
}

// Was a hardcoded constant (Tulips Technologies' own address/phone/email, plus a Google Maps
// embed of their specific office) - this is this app's own public marketing site, so a company
// running their own deployment needs this to describe THEM, not whichever company the code was
// originally written for. Reads the same CompanySettings fields Settings > Company Profile
// already captures; any address/phone/email left unset on a fresh deployment is simply omitted
// by the pages that render this, never defaulted back to Tulips' own values. Mirrors the
// try/catch pattern PublicFooter.tsx already uses for FooterText.
export async function getContactInfo(): Promise<ContactInfo> {
  try {
    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    const result = await db.query<{
      AddressLine1: string | null;
      AddressLine2: string | null;
      City: string | null;
      State: string | null;
      PostalCode: string | null;
      Country: string | null;
      ContactEmail: string | null;
      ContactPhone: string | null;
    }>`
      SELECT AddressLine1, AddressLine2, City, State, PostalCode, Country, ContactEmail, ContactPhone
      FROM CompanySettings WHERE Id = 1
    `;
    const row = result.recordset[0];
    const addressParts = [row?.AddressLine1, row?.AddressLine2, row?.City, row?.State, row?.PostalCode, row?.Country].filter(
      (p): p is string => !!p
    );
    return {
      address: addressParts.length > 0 ? addressParts.join(", ") : null,
      phone: row?.ContactPhone ?? null,
      email: row?.ContactEmail ?? null,
      hours: null,
      mapEmbedUrl: null,
    };
  } catch {
    return { address: null, phone: null, email: null, hours: null, mapEmbedUrl: null };
  }
}

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
