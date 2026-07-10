// Flat, hand-maintained search index for the Company Settings page — same manual-array
// style as the dashboard header's SEARCH_INDEX (src/lib/navRoutes.ts). Each `id` must match
// a `<div id={"field-" + id}>` wrapper rendered by the corresponding section component —
// that id is the contract SettingsSearch.tsx relies on to scroll to and highlight a match.
export interface SettingsSearchEntry {
  id: string;
  section: string;
  label: string;
}

export const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  // Company Profile
  { id: "company-name", section: "company-profile", label: "Company Name" },
  { id: "company-logo", section: "company-profile", label: "Company Logo" },
  { id: "website-url", section: "company-profile", label: "Website URL" },
  { id: "industry", section: "company-profile", label: "Industry" },
  { id: "company-size", section: "company-profile", label: "Company Size" },
  { id: "company-address", section: "company-profile", label: "Company Address" },
  { id: "contact-email", section: "company-profile", label: "Contact Email" },
  { id: "contact-phone", section: "company-profile", label: "Contact Phone Number" },

  // Organization Management
  { id: "departments", section: "organization", label: "Departments" },
  { id: "teams", section: "organization", label: "Teams" },
  { id: "branch-offices", section: "organization", label: "Branch Offices" },
  { id: "job-designations", section: "organization", label: "Job Designations" },

  // Users and Access
  { id: "employee-accounts", section: "users-access", label: "Employee Accounts" },
  { id: "roles-permissions", section: "users-access", label: "Roles and Permissions" },
  { id: "user-groups", section: "users-access", label: "User Groups" },
  { id: "employee-accounts", section: "users-access", label: "Administrator Management" },
  { id: "employee-accounts", section: "users-access", label: "Multi-Factor Authentication" },
  { id: "login-activity", section: "users-access", label: "Login Activity" },

  // Security
  { id: "password-policy", section: "security", label: "Password Policy" },
  { id: "single-sign-on", section: "security", label: "Single Sign-On" },
  { id: "api-keys", section: "security", label: "API Keys" },
  { id: "ip-whitelisting", section: "security", label: "IP Whitelisting" },
  { id: "session-management", section: "security", label: "Session Management" },
  { id: "account-lockout-rules", section: "security", label: "Account Lockout Rules" },

  // SMTP and Email Setup
  { id: "smtp-host", section: "smtp-email", label: "SMTP Host" },
  { id: "smtp-port", section: "smtp-email", label: "SMTP Port" },
  { id: "smtp-username", section: "smtp-email", label: "SMTP Username" },
  { id: "smtp-password", section: "smtp-email", label: "SMTP Password" },
  { id: "encryption-type", section: "smtp-email", label: "Encryption Type" },
  { id: "sender-name", section: "smtp-email", label: "Sender Name" },
  { id: "sender-email", section: "smtp-email", label: "Sender Email Address" },
  { id: "reply-to", section: "smtp-email", label: "Reply-To Email Address" },
  { id: "email-authentication", section: "smtp-email", label: "Email Authentication" },
  { id: "send-test-email", section: "smtp-email", label: "Send Test Email" },
  { id: "smtp-connection-status", section: "smtp-email", label: "SMTP Connection Status" },
  { id: "email-delivery-logs", section: "smtp-email", label: "Email Delivery Logs" },

  // Integrations
  { id: "integrations", section: "integrations", label: "GitHub" },
  { id: "integrations", section: "integrations", label: "GitLab" },
  { id: "integrations", section: "integrations", label: "Jira" },
  { id: "integrations", section: "integrations", label: "Slack" },
  { id: "integrations", section: "integrations", label: "Microsoft Teams" },
  { id: "integrations", section: "integrations", label: "Google Workspace" },
  { id: "integrations", section: "integrations", label: "Microsoft Azure Active Directory" },
  { id: "integrations", section: "integrations", label: "Webhooks" },
  { id: "integrations", section: "integrations", label: "Custom API Integrations" },

  // Notifications
  { id: "notification-channels", section: "notifications", label: "Email Notifications" },
  { id: "notification-channels", section: "notifications", label: "SMS Notifications" },
  { id: "notification-channels", section: "notifications", label: "Push Notifications" },
  { id: "notification-channels", section: "notifications", label: "In-App Notifications" },
  { id: "notification-templates", section: "notifications", label: "Notification Templates" },
  { id: "notification-rules", section: "notifications", label: "Event-Based Notification Rules" },

  // Branding
  { id: "primary-color", section: "branding", label: "Primary Color" },
  { id: "secondary-color", section: "branding", label: "Secondary Color" },
  { id: "branding-logo", section: "branding", label: "Company Logo (Branding)" },
  { id: "favicon", section: "branding", label: "Favicon" },
  { id: "login-branding", section: "branding", label: "Login Page Branding" },
  { id: "branding-email-templates", section: "branding", label: "Email Templates" },
  { id: "custom-footer-text", section: "branding", label: "Custom Footer Text" },

  // Backup and Data
  { id: "database-backup", section: "backup-data", label: "Database Backup" },
  { id: "backup-schedule", section: "backup-data", label: "Automatic Backup Schedule" },
  { id: "data-restore", section: "backup-data", label: "Data Restore" },
  { id: "data-export", section: "backup-data", label: "Data Export" },
  { id: "data-retention-policy", section: "backup-data", label: "Data Retention Policy" },
  { id: "backup-history", section: "backup-data", label: "Backup History" },

  // System Settings
  { id: "general-settings", section: "system", label: "General Settings" },
  { id: "default-timezone", section: "system", label: "Default Time Zone" },
  { id: "default-language", section: "system", label: "Default Language" },
  { id: "date-format", section: "system", label: "Date Format" },
  { id: "time-format", section: "system", label: "Time Format" },
  { id: "maintenance-mode", section: "system", label: "Maintenance Mode" },
  { id: "system-logs", section: "system", label: "System Logs" },
  { id: "application-version", section: "system", label: "Application Version" },

  // Audit Log
  { id: "audit-logs", section: "audit-log", label: "Audit Logs" },
];

export const SETTINGS_SECTIONS: { key: string; label: string }[] = [
  { key: "company-profile", label: "Company Profile" },
  { key: "organization", label: "Organization Management" },
  { key: "users-access", label: "Users and Access" },
  { key: "security", label: "Security" },
  { key: "smtp-email", label: "SMTP and Email Setup" },
  { key: "integrations", label: "Integrations" },
  { key: "notifications", label: "Notifications" },
  { key: "branding", label: "Branding" },
  { key: "backup-data", label: "Backup and Data" },
  { key: "system", label: "System Settings" },
  { key: "audit-log", label: "Audit Log" },
];
