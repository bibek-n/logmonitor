import crypto from "crypto";
import { getDb, sql } from "./db";
import { sendNotificationEmail } from "./notifyEmail";

export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

const POLICY_TEXT = `A reminder of our dashboard usage policy:
- Never share your login credentials or one-time codes with anyone.
- Always log out when using a shared or public computer.
- Report any suspicious account activity to your administrator immediately.
- Data accessed through this dashboard is confidential — do not export or share it outside authorized use.`;

// Fallback content used only if the seeded NotificationTemplates rows (see
// scripts/migrate-login-otp.ts) are somehow missing — keeps login working even if an
// admin deletes the template. Real editing happens via Company Settings > Notifications.
const FALLBACK_TEMPLATES: Record<string, { subject: string; body: string }> = {
  login_otp_code: {
    subject: "Your Log Monitor login code",
    body: `Your Log Monitor login code is: {{code}}

This code expires in {{expiryMinutes}} minutes. If you didn't try to sign in, you can ignore this email.

Dashboard: {{dashboardUrl}}

${POLICY_TEXT}`,
  },
  login_success: {
    subject: "Login Successful — Log Monitor",
    body: `Hi {{name}},

You successfully signed in to Log Monitor on {{date}} from IP {{ip}}.

Dashboard: {{dashboardUrl}}

${POLICY_TEXT}

If this wasn't you, contact your administrator right away.`,
  },
};

export function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/{{\s*(\w+)\s*}}/g, (_match, key) => vars[key] ?? "");
}

export function getDashboardUrl(): string {
  const base = process.env.NEXTAUTH_URL?.replace(/\/+$/, "") || "https://logs.tulipshrm.com:4433";
  return `${base}/dashboard`;
}

async function getTemplate(key: string): Promise<{ subject: string; body: string }> {
  try {
    const db = await getDb();
    const result = await db
      .request()
      .input("key", sql.NVarChar, key)
      .query<{ Subject: string | null; Body: string | null }>("SELECT Subject, Body FROM NotificationTemplates WHERE [Key] = @key");
    const row = result.recordset[0];
    if (row?.Subject && row.Body) return { subject: row.Subject, body: row.Body };
  } catch {
    // NotificationTemplates may not exist yet on older deployments — fall through.
  }
  return FALLBACK_TEMPLATES[key];
}

export async function sendOtpCodeEmail(to: string, code: string): Promise<void> {
  const template = await getTemplate("login_otp_code");
  const vars = { code, expiryMinutes: String(OTP_EXPIRY_MINUTES), dashboardUrl: getDashboardUrl() };
  await sendNotificationEmail({
    to,
    subject: renderTemplate(template.subject, vars),
    body: renderTemplate(template.body, vars),
  });
}

export async function sendLoginSuccessEmail(to: string, vars: { name: string; date: string; ip: string }): Promise<void> {
  const template = await getTemplate("login_success");
  const allVars = { ...vars, dashboardUrl: getDashboardUrl() };
  await sendNotificationEmail({
    to,
    subject: renderTemplate(template.subject, allVars),
    body: renderTemplate(template.body, allVars),
  });
}
