// Canned messages for the Send Notification page's "Insert template" picker
// (src/components/notifications/NotificationsClient.tsx). Purely a client-side starting
// point for the admin to edit before sending — there's no DB-backed template table here,
// unlike the unrelated ticket-email NotificationTemplates system under Company Settings.
// Every message must stay under the 500-char cap enforced by
// POST /api/admin/notifications/send.

export interface NotificationTemplate {
  id: string;
  category: string;
  label: string;
  message: string;
}

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    id: "scheduled-maintenance",
    category: "Maintenance",
    label: "Scheduled system maintenance",
    message:
      "Scheduled system maintenance will take place on [DATE] from [START TIME] to [END TIME]. Some services may be temporarily unavailable. Thank you for your patience.",
  },
  {
    id: "network-outage",
    category: "Maintenance",
    label: "Network outage in progress",
    message:
      "We are currently experiencing a network outage. Our IT team is actively working on it and will update you as soon as service is restored.",
  },
  {
    id: "internet-slowdown",
    category: "Maintenance",
    label: "Internet slowdown notice",
    message:
      "We're aware of a temporary slowdown in internet speed and are investigating the cause. Thank you for your patience while we resolve it.",
  },
  {
    id: "software-update",
    category: "Maintenance",
    label: "Software update required",
    message:
      "A critical software update is available for your device. Please save your work and restart your computer at your earliest convenience to apply it.",
  },
  {
    id: "antivirus-scan",
    category: "Maintenance",
    label: "Routine antivirus scan",
    message:
      "A routine antivirus scan will run on your computer shortly. You may notice a slight slowdown in performance while it completes.",
  },
  {
    id: "security-alert",
    category: "Security",
    label: "Security alert",
    message:
      "We've detected unusual activity on the network. Please avoid clicking on suspicious links or email attachments and report anything unusual to IT immediately.",
  },
  {
    id: "password-expiry",
    category: "Security",
    label: "Password expiry reminder",
    message:
      "Your network password will expire soon. Please update it before it expires to avoid being locked out of your account.",
  },
  {
    id: "phishing-warning",
    category: "Security",
    label: "Phishing email warning",
    message:
      "A phishing email is currently circulating. Do not click any links or open attachments from unfamiliar senders. Report suspicious emails to IT right away.",
  },
  {
    id: "meeting-reminder",
    category: "Reminders",
    label: "Team meeting reminder",
    message: "Reminder: there's a team meeting today. Please make sure to join on time.",
  },
  {
    id: "end-of-day",
    category: "Reminders",
    label: "End of day reminder",
    message: "Please remember to save your work and log off your computer properly before leaving for the day.",
  },
  {
    id: "backup-reminder",
    category: "Reminders",
    label: "Save files to shared drive",
    message:
      "Please make sure any important files are saved to the shared drive. Scheduled backups do not cover files stored only on your local desktop.",
  },
  {
    id: "office-closure",
    category: "Office",
    label: "Office closure notice",
    message: "Please note the office will be closed on [DATE] for [REASON]. Normal operations resume the next business day.",
  },
  {
    id: "welcome-message",
    category: "Office",
    label: "Welcome new employee",
    message:
      "Welcome to the team! If you run into any IT-related questions or issues, feel free to reach out to the IT department at any time.",
  },
];
