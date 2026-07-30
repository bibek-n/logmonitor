import { sendNotificationEmail } from "../notifyEmail";

export interface TemplateVars {
  sender: string;
  recipient: string;
  subject: string;
  file_name: string;
  detected_type: string;
  policy_name: string;
  block_reason: string;
  incident_id: string;
  timestamp: string;
  support_email: string;
}

// {{var}} substitution only - never eval, never any templating engine that could execute
// admin- or attacker-influenced content. Unknown {{tokens}} are left as-is rather than
// silently dropped, so a template typo is visible instead of hidden.
export function renderTemplate(template: string, vars: Partial<TemplateVars>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = (vars as Record<string, string | undefined>)[key];
    return value !== undefined ? value : match;
  });
}

export interface NotificationRecipient {
  to: string;
  role: "sender" | "recipient" | "admin";
}

export interface NotificationOutcome {
  role: string;
  to: string;
  success: boolean;
  error?: string;
}

// Sends one rendered notification per configured recipient and returns a per-recipient
// outcome list - callers persist this into MailSecurityIncidents.NotificationStatus. Never
// throws: a notification failure must never break the policy-evaluation flow that triggered
// it (same "best-effort, non-throwing" contract sendNotificationEmail already documents).
export async function sendPolicyNotifications(
  subjectTemplate: string,
  bodyTemplate: string,
  vars: TemplateVars,
  recipients: NotificationRecipient[]
): Promise<NotificationOutcome[]> {
  const subject = renderTemplate(subjectTemplate, vars);
  const body = renderTemplate(bodyTemplate, vars);

  const outcomes: NotificationOutcome[] = [];
  for (const recipient of recipients) {
    if (!recipient.to) continue;
    const result = await sendNotificationEmail({ to: recipient.to, subject, body });
    outcomes.push({ role: recipient.role, to: recipient.to, success: result.success, error: result.error });
  }
  return outcomes;
}

export function summarizeNotificationOutcomes(outcomes: NotificationOutcome[]): string {
  if (outcomes.length === 0) return "No notifications configured";
  return outcomes.map((o) => `${o.role}: ${o.success ? "sent" : `failed (${o.error ?? "unknown error"})`}`).join(", ");
}
