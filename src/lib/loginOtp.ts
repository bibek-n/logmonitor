import crypto from "crypto";
import { getDb, sql } from "./db";
import { sendNotificationEmail } from "./notifyEmail";
import { PASSWORD_RESET_TOKEN_TTL_MINUTES } from "./authCore";

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
    subject: "Your Tulips Unified Admin Center login code",
    body: `Your Tulips Unified Admin Center login code is: {{code}}

This code expires in {{expiryMinutes}} minutes. If you didn't try to sign in, you can ignore this email.

Dashboard: {{dashboardUrl}}

${POLICY_TEXT}`,
  },
  login_success: {
    subject: "Login Successful — Tulips Unified Admin Center",
    body: `Hi {{name}},

You successfully signed in to Tulips Unified Admin Center on {{date}} from IP {{ip}}.

Dashboard: {{dashboardUrl}}

${POLICY_TEXT}

If this wasn't you, contact your administrator right away.`,
  },
  password_reset: {
    subject: "Reset your Tulips Unified Admin Center password",
    body: `We received a request to reset the password for your Tulips Unified Admin Center account ({{username}}).

Reset your password: {{resetUrl}}

This link expires in {{expiryMinutes}} minutes and can only be used once. If you didn't request this, you can safely ignore this email — your password won't be changed.

${POLICY_TEXT}`,
  },
};

export function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/{{\s*(\w+)\s*}}/g, (_match, key) => vars[key] ?? "");
}

// NEXTAUTH_URL is already a required env var for any NextAuth deployment - the fallback below is
// only reached if that's somehow unset, so it's a generic placeholder rather than a hardcoded
// domain specific to one deployment.
export function getDashboardUrl(): string {
  const base = process.env.NEXTAUTH_URL?.replace(/\/+$/, "") || "http://localhost:3000";
  return `${base}/dashboard`;
}

export function getPasswordResetUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL?.replace(/\/+$/, "") || "http://localhost:3000";
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
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

export async function sendPasswordResetEmail(to: string, username: string, resetUrl: string): Promise<void> {
  const template = await getTemplate("password_reset");
  const vars = { username, resetUrl, expiryMinutes: String(PASSWORD_RESET_TOKEN_TTL_MINUTES) };
  await sendNotificationEmail({
    to,
    subject: renderTemplate(template.subject, vars),
    body: renderTemplate(template.body, vars),
  });
}
