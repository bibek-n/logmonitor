import type { WidgetModule, WidgetSize } from "./types";

// The full Overview-dashboard widget catalog: every widget the Manage Widgets dialog can show,
// grouped by module. This is a plain-data list (id/module/label/description/defaultSize) with
// no JSX so it's importable from both server and client code; the actual rendered content for
// each id is built in src/app/dashboard/page.tsx (server-side, from real queries) and looked up
// by id in DashboardGridClient.
//
// Deliberately does NOT include a widget for anything this app has no real data for yet (VPN
// connections, domain WHOIS expiry, website traffic/analytics, account lockout, pending
// invitations, password-expiry policy, database engine health, license/subscription status,
// download activity tracking, perimeter firewall/internet-uptime monitoring) - see the
// commit that introduced this file for the full per-module research behind each inclusion/
// exclusion.
export interface WidgetCatalogEntry {
  id: string;
  module: WidgetModule;
  label: string;
  description: string;
  defaultSize: WidgetSize;
}

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  // --- Dashboard ---
  { id: "welcome", module: "dashboard", label: "Welcome", description: "Personal greeting with today's date.", defaultSize: "medium" },
  { id: "notes", module: "dashboard", label: "Notes", description: "A private scratchpad only you can see, auto-saved as you type.", defaultSize: "medium" },
  { id: "quickStats", module: "dashboard", label: "Quick Stats", description: "Users, devices, servers, websites, automations, and open alerts at a glance.", defaultSize: "full" },
  { id: "systemHealth", module: "dashboard", label: "System Health (KPIs)", description: "CPU, memory, disk, WAN, LAN, and active users.", defaultSize: "full" },
  { id: "bandwidth", module: "dashboard", label: "Network Traffic Graph", description: "WLAN upload/download rate over time.", defaultSize: "full" },
  { id: "recentAlerts", module: "dashboard", label: "Recent Alerts", description: "MikroTik warnings/errors and current DHCP conflicts.", defaultSize: "medium" },
  { id: "systemLogs", module: "dashboard", label: "System Logs", description: "Chronological device/alert event timeline.", defaultSize: "medium" },
  { id: "activityFeed", module: "dashboard", label: "Activity Feed", description: "Recent admin actions across every module (from the audit log).", defaultSize: "medium" },
  { id: "notifications", module: "dashboard", label: "Notifications", description: "Unread in-app notifications and active maintenance windows.", defaultSize: "medium" },
  { id: "quickActions", module: "dashboard", label: "Quick Actions", description: "Shortcut buttons to common admin tasks across every module.", defaultSize: "medium" },
  { id: "operationsSnapshot", module: "dashboard", label: "Operations Snapshot", description: "Health score, network info, top devices, threat detection, and traffic by country.", defaultSize: "full" },
  { id: "calendarWeather", module: "dashboard", label: "Calendar & Weather", description: "Nepali calendar and weather overview.", defaultSize: "full" },
  { id: "deviceStatus", module: "dashboard", label: "Employee Device Status", description: "Total/online/offline/attention-needed employee devices.", defaultSize: "full" },

  // --- User Management ---
  { id: "userSummary", module: "userManagement", label: "User Summary", description: "Total, active, disabled, and MFA-enabled user counts.", defaultSize: "medium" },
  { id: "loginStatistics", module: "userManagement", label: "Login Statistics", description: "Successful and failed login attempts, last 24 hours.", defaultSize: "medium" },
  { id: "activeDirectoryStatus", module: "userManagement", label: "Staff", description: "Online/offline status for staff with a saved device IP, checked live via ping.", defaultSize: "medium" },

  // --- Security Center ---
  { id: "securitySummary", module: "securityCenter", label: "Security Score & Alerts", description: "Overall security score, critical alerts, and blocked IPs.", defaultSize: "medium" },
  { id: "vulnerabilitySummary", module: "securityCenter", label: "Vulnerability Summary", description: "Open vulnerability findings by severity.", defaultSize: "medium" },
  { id: "patchStatus", module: "securityCenter", label: "Patch Status", description: "Critical patches pending, failed installations, servers awaiting reboot.", defaultSize: "medium" },

  // --- Network Management ---
  { id: "connectedDevices", module: "networkManagement", label: "Connected Devices", description: "Devices currently online right now, combined from MikroTik and Sophos - drops off the instant a device disconnects.", defaultSize: "medium" },
  { id: "offlineDevices", module: "networkManagement", label: "Offline Devices", description: "Enrolled devices that have missed their last heartbeat window.", defaultSize: "medium" },
  { id: "allServers", module: "networkManagement", label: "All Servers", description: "Every registered server (web, database, or other role), offline ones listed first.", defaultSize: "medium" },
  { id: "networkFirewall", module: "networkManagement", label: "Firewall Status", description: "Devices reporting firewall enabled vs. disabled.", defaultSize: "medium" },
  { id: "cameraRotation", module: "networkManagement", label: "Cameras", description: "Live camera snapshots, 8 at a time, rotating through every camera every 5 minutes.", defaultSize: "full" },

  // --- Remote Access ---
  { id: "remoteAccessSummary", module: "remoteAccess", label: "Remote Access", description: "Active sessions, pending approval requests, and recent connections.", defaultSize: "medium" },

  // --- IT Asset Management ---
  { id: "itAssetSummary", module: "itAssetManagement", label: "Asset Summary", description: "Assigned/available assets, warranty and license expiry, inventory status.", defaultSize: "medium" },

  // --- Browser Activity ---
  { id: "browserActivitySummary", module: "browserActivity", label: "Browser Activity", description: "Top visited domains and flagged high-risk visits, last 24 hours.", defaultSize: "medium" },

  // --- Website Management ---
  { id: "websiteSummary", module: "websiteManagement", label: "Website Summary", description: "Registered websites by environment (Live/Staging/Dev).", defaultSize: "medium" },
  { id: "expiringSsl", module: "websiteManagement", label: "SSL Certificate Expiry", description: "Certificates expiring within 1 month or already expired.", defaultSize: "medium" },
  { id: "domainExpiry", module: "websiteManagement", label: "Domain Expiry", description: "Domain registrations expiring within 2 months or already expired, from the live website list.", defaultSize: "medium" },

  // --- Website & API Monitoring ---
  { id: "monitoringSummary", module: "websiteApiMonitoring", label: "Uptime & Response Time", description: "Website/API up-down counts, average response time, error rate.", defaultSize: "medium" },
  { id: "recentIncidents", module: "websiteApiMonitoring", label: "Status History", description: "Most recent monitoring incidents across all websites and APIs.", defaultSize: "medium" },
  { id: "offlineWebsites", module: "websiteApiMonitoring", label: "Offline Websites", description: "Websites currently Down, with the last error and HTTP status seen. Refreshes live every 2 minutes.", defaultSize: "medium" },

  // --- Automation ---
  { id: "automationSummary", module: "automation", label: "Automation Summary", description: "Scheduled jobs, running jobs, and 7-day success rate.", defaultSize: "medium" },

  // --- Administration ---
  { id: "administrationSummary", module: "administration", label: "Administration", description: "Backup status, servers needing updates, today's audit log activity.", defaultSize: "medium" },
  { id: "malwareFindings", module: "administration", label: "Open Malware Findings", description: "Unresolved malware detections across scanned devices.", defaultSize: "medium" },
  { id: "topBandwidthConsumers", module: "administration", label: "Top Bandwidth Consumers (Sophos)", description: "Highest-bandwidth IPs from the Sophos firewall, last 6 hours.", defaultSize: "medium" },
  { id: "topBandwidthRouterClients", module: "administration", label: "Top Bandwidth Consumers (MikroTik)", description: "Highest-bandwidth clients from the MikroTik router's own IP accounting, last 6 hours.", defaultSize: "medium" },
  { id: "topBandwidthStaff", module: "administration", label: "Top Bandwidth Consumers (Staff)", description: "Highest-bandwidth staff, combining both MikroTik and Sophos firewall traffic with their IP addresses, last 1 hour.", defaultSize: "medium" },
  { id: "totalSophosBandwidth", module: "administration", label: "Total Bandwidth (Sophos)", description: "Total incoming and outgoing bandwidth across the network, from Sophos firewall logs, last 1 hour.", defaultSize: "small" },
  { id: "topVisited", module: "administration", label: "Top Visited Sites", description: "Most-visited websites, combining Sophos web filter and MikroTik router logs, last 1 hour.", defaultSize: "medium" },
  { id: "wifiUsers", module: "administration", label: "WiFi Users", description: "All currently connected clients across MikroTik and Sophos, with resolved staff name, MAC, and IP address. Refreshes hourly.", defaultSize: "medium" },
];

export function getCatalogEntry(id: string): WidgetCatalogEntry | undefined {
  return WIDGET_CATALOG.find((w) => w.id === id);
}

// First-visit default for a non-Admin session (one with no saved DashboardLayouts row - that
// table is only ever written to by an Admin session today, see src/app/dashboard/page.tsx).
// Rather than default every viewer to the full catalog regardless of role, a restricted
// viewer's unarranged dashboard starts with just the general-purpose "dashboard" module
// widgets (KPIs, alerts, notes, quick stats) instead of every module-specific widget - still
// fully customizable via Manage Widgets, this only changes what they see before they've
// touched anything.
export const RESTRICTED_DEFAULT_WIDGET_IDS: string[] = WIDGET_CATALOG.filter((w) => w.module === "dashboard").map((w) => w.id);



