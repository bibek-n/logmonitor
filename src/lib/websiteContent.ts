// Static, hand-authored public-site content and navigation/footer config — mirrors the
// pattern already used by src/lib/navRoutes.ts for the internal dashboard's own nav.
// Deliberately NOT database-backed yet (see the approved plan): the slider and support
// ticket system are the two things this phase makes dashboard-editable; everything else
// here ships as real, professional content edited by touching this file, with a generic
// CMS layer for these sections deferred to a later phase.

export interface NavItem {
  label: string;
  href: string;
}

export const PUBLIC_NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About Software", href: "/about-software" },
  { label: "About Us", href: "/about-us" },
  { label: "Support", href: "/support" },
  { label: "Support Tickets", href: "/support/tickets/new" },
  { label: "Contact Us", href: "/contact" },
];

export interface ServiceItem {
  title: string;
  description: string;
  icon: string; // lucide-react icon name, resolved by the rendering component
}

export const SERVICES: ServiceItem[] = [
  { title: "Security Management", description: "Protect systems with real-time security monitoring and alerts.", icon: "ShieldCheck" },
  { title: "Network System", description: "Monitor network devices, uptime, bandwidth, and connectivity.", icon: "Network" },
  { title: "Hardware Management", description: "Track computers, servers, printers, and other IT assets.", icon: "HardDrive" },
  { title: "Staff Monitoring", description: "Monitor staff activities, attendance, productivity, and system usage.", icon: "Users" },
  { title: "Support Management", description: "Provide technical support and issue resolution.", icon: "LifeBuoy" },
  { title: "Support Tickets", description: "Allow users to submit and track support requests.", icon: "Ticket" },
];

export interface FeatureItem {
  title: string;
  description: string;
}

export const ABOUT_SOFTWARE_FEATURES: FeatureItem[] = [
  { title: "Security Monitoring", description: "Continuous visibility into firewall events, threats, and system security posture across your infrastructure." },
  { title: "Network Monitoring", description: "Real-time tracking of routers, bandwidth usage, connected devices, and network health." },
  { title: "Hardware Asset Management", description: "A complete inventory of computers, servers, and endpoint hardware, including specs and health status." },
  { title: "Staff Activity Monitoring", description: "Consent-based visibility into staff device activity, with privacy controls built in from the ground up." },
  { title: "System Alerts and Notifications", description: "Instant alerts when thresholds are crossed — high CPU, disk failures, security events, and more." },
  { title: "Dashboard Reporting", description: "Clear, real-time dashboards summarizing the health and status of your entire IT environment." },
  { title: "User and Role Management", description: "Control who can access what, with role-based permissions across the platform." },
  { title: "Ticket Management", description: "A built-in support ticket system so issues get tracked, assigned, and resolved." },
  { title: "Audit Logs", description: "A full trail of who did what and when — critical for accountability and compliance." },
  { title: "Secure Authentication", description: "Encrypted credentials and session management to keep access to your systems locked down." },
];

export interface WhyChooseUsItem {
  title: string;
  icon: string;
}

export const WHY_CHOOSE_US: WhyChooseUsItem[] = [
  { title: "Real-Time Monitoring", icon: "Activity" },
  { title: "Secure System", icon: "Lock" },
  { title: "Easy-to-Use Dashboard", icon: "LayoutDashboard" },
  { title: "Fast Support", icon: "Zap" },
  { title: "Cloud Ready", icon: "Cloud" },
  { title: "Scalable Architecture", icon: "TrendingUp" },
  { title: "Role-Based Access Control", icon: "KeyRound" },
  { title: "Automatic Reports", icon: "FileText" },
  { title: "Data Protection", icon: "ShieldCheck" },
  { title: "24/7 Monitoring", icon: "Clock" },
];

export const ABOUT_US = {
  intro:
    "We provide comprehensive IT management solutions designed to help organizations efficiently manage their technology infrastructure.",
  combined:
    "Our platform combines Security Monitoring, Network Management, Hardware Asset Tracking, Staff Monitoring, and Support Ticket Management into one centralized system.",
  missionStatement:
    "Our mission is to improve security, increase operational efficiency, and simplify IT administration through an easy-to-use, secure, and scalable platform.",
  vision:
    "To become a trusted provider of secure and intelligent IT management solutions that empower organizations to protect their digital infrastructure and improve productivity.",
  missionPoints: [
    "Deliver secure and reliable IT solutions",
    "Simplify infrastructure management",
    "Improve organizational productivity",
    "Enhance cybersecurity",
    "Provide excellent customer support",
  ],
};

// Placeholders where the real business detail isn't known yet — find/replace once
// provided, per the approved plan (never invent real-looking facts).
export const CONTACT_INFO = {
  address: "[Company Address]",
  phone: "[Phone Number]",
  email: "support@websearchpro.net",
  hours: "[Business Hours]",
  mapEmbedUrl: null as string | null, // needs a real address before a map can be embedded
};

export const FOOTER_LINKS = {
  quickLinks: [
    { label: "About Us", href: "/about-us" },
    { label: "Services", href: "/services" },
    { label: "Support", href: "/support" },
    { label: "Support Tickets", href: "/support/tickets/new" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms & Conditions", href: "/terms" },
  ],
  social: [] as { label: string; href: string }[],
};

export const SUPPORT_RESOURCES = {
  faqs: [
    {
      question: "How do I get access to the dashboard?",
      answer: "Dashboard access is provisioned by your IT administrator. Contact support if you need an account.",
    },
    {
      question: "How do I report an issue?",
      answer: "Submit a support ticket with as much detail as possible, including a screenshot if relevant.",
    },
    {
      question: "How can I check the status of a ticket I submitted?",
      answer: "Use the \"Check Ticket Status\" page with your ticket number and the email you submitted with.",
    },
    {
      question: "Is staff monitoring done without consent?",
      answer: "No — endpoint monitoring only begins after explicit local consent is given on the device itself, and is limited to company-owned devices under written policy.",
    },
  ],
  guides: [
    "Getting started with the monitoring dashboard",
    "Understanding alerts and severity levels",
    "Submitting and tracking a support ticket",
  ],
};

export const TICKET_CATEGORIES = ["General Inquiry", "Technical Issue", "Billing", "Feature Request", "Bug Report", "Other"];
export const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
