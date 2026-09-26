// Predefined lists for the Server Room module. Shared by the server (validation) and the client pages (dropdowns);
// keep this file free of server-only imports.

// The 15 reasons for entering the server room (spec: Server Room Entry -> Reason / Task).
export const ENTRY_REASONS = [
  "Technical Support",
  "Server Maintenance",
  "Website Hosting Task",
  "Security Update",
  "OS Update",
  "Application Update",
  "Package Update",
  "Firmware Update",
  "Server Scan",
  "Troubleshooting",
  "Hardware Maintenance",
  "Backup/Restore",
  "Network Maintenance",
  "Security Incident",
  "Other",
] as const;

export const TASK_GROUPS = ["Technical Support", "Website Hosting", "Security Update"] as const;
export type TaskGroup = (typeof TASK_GROUPS)[number];

// Task types per group. Technical Support = the maintenance-style categories; Website Hosting and Security Update
// are the specific activities listed in the spec.
export const TASK_TYPES: Record<TaskGroup, readonly string[]> = {
  "Technical Support": [
    "Technical Support",
    "Server Maintenance",
    "Troubleshooting",
    "Hardware Maintenance",
    "Backup/Restore",
    "Network Maintenance",
    "Server Scan",
    "OS Update",
    "Application Update",
    "Package Update",
    "Firmware Update",
    "Other",
  ],
  "Website Hosting": [
    "Website deployment",
    "Website maintenance",
    "Domain/DNS work",
    "SSL/TLS certificate work",
    "Web-server configuration",
    "Application deployment",
    "Backup/restore",
    "Hosting troubleshooting",
    "Web-server security updates",
  ],
  "Security Update": [
    "Security patching",
    "Vulnerability remediation",
    "Antivirus/security-agent update",
    "Firewall configuration",
    "Security scanning",
    "Hardening",
    "Security incident investigation",
  ],
};

export const TASK_STATUSES = ["In Progress", "Completed", "Blocked", "Cancelled"] as const;
export const INCIDENT_STATUSES = ["Open", "Investigating", "Resolved", "Closed"] as const;
export const INCIDENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;

// Steps of the chain device -> finding -> update -> staff -> task -> action -> resolution (+ free notes).
export const STEP_TYPES = ["finding", "update", "staff", "task", "action", "resolution", "note"] as const;

export const INCIDENT_NUMBER_RE = /^INC-\d{4}-\d{6}$/;
