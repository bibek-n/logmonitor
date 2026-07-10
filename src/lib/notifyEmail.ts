import net from "net";
import { getDb, sql } from "./db";
import { connectRaw, connectTlsDirect, upgradeToTls, sendCmd, replyCode, dotStuff, readSmtpReply } from "./emailTools";

export interface NotifyEmailOptions {
  to: string;
  subject: string;
  body: string;
}

interface ResolvedSmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
}

async function logDelivery(toAddress: string, subject: string, success: boolean, errorMessage?: string): Promise<void> {
  try {
    const db = await getDb();
    await db
      .request()
      .input("toAddress", sql.NVarChar, toAddress)
      .input("subject", sql.NVarChar, subject)
      .input("success", sql.Bit, success)
      .input("errorMessage", sql.NVarChar, errorMessage ?? null)
      .query("INSERT INTO EmailDeliveryLog (ToAddress, Subject, Success, ErrorMessage) VALUES (@toAddress, @subject, @success, @errorMessage)");
  } catch (err) {
    console.error("[notifyEmail] failed to write EmailDeliveryLog row:", err instanceof Error ? err.message : err);
  }
}

// Prefers the DB-backed SmtpSettings row (managed from Dashboard > Company Settings > SMTP
// & Email) over the legacy NOTIFY_SMTP_* env vars, so existing deployments that only ever
// set env vars keep working unchanged until an admin configures the DB row.
async function resolveSmtpConfig(): Promise<ResolvedSmtpConfig | null> {
  try {
    const db = await getDb();
    const result = await db.query<{
      Host: string | null;
      Port: number | null;
      Username: string | null;
      Password: string | null;
      SenderEmail: string | null;
    }>`SELECT Host, Port, Username, Password, SenderEmail FROM SmtpSettings WHERE Id = 1`;
    const row = result.recordset[0];
    if (row?.Host && row.Username && row.Password && row.SenderEmail) {
      return { host: row.Host, port: row.Port ?? 587, username: row.Username, password: row.Password, from: row.SenderEmail };
    }
  } catch {
    // SmtpSettings table may not exist yet on older deployments — fall through to env vars.
  }

  const host = process.env.NOTIFY_SMTP_HOST;
  const username = process.env.NOTIFY_SMTP_USER;
  const password = process.env.NOTIFY_SMTP_PASSWORD;
  const from = process.env.NOTIFY_FROM_EMAIL;
  if (!host || !username || !password || !from) return null;
  return { host, port: Number(process.env.NOTIFY_SMTP_PORT || 587), username, password, from };
}

async function notificationsEnabled(): Promise<boolean> {
  try {
    const db = await getDb();
    const result = await db.query<{ EmailEnabled: boolean }>`SELECT EmailEnabled FROM NotificationPreferences WHERE Id = 1`;
    if (result.recordset[0]) return result.recordset[0].EmailEnabled;
  } catch {
    // NotificationPreferences table may not exist yet on older deployments.
  }
  return process.env.EMAIL_NOTIFICATIONS_ENABLED === "true";
}

// Best-effort, non-throwing: a notification failure should never break the ticket/contact
// flow that triggered it. Reuses the same raw-socket SMTP primitives as emailTools.ts's
// Email Delivery Test tool rather than nodemailer, which has a proven crash bug on this
// app's Windows/iisnode hosting. Every attempt (success or failure) writes one
// EmailDeliveryLog row for the Company Settings > SMTP & Email > Delivery Logs view.
export async function sendNotificationEmail(opts: NotifyEmailOptions): Promise<void> {
  if (!(await notificationsEnabled())) {
    console.log(`[notifyEmail] notifications disabled — would have sent to ${opts.to}: "${opts.subject}"`);
    return;
  }

  const config = await resolveSmtpConfig();
  if (!config) {
    console.error("[notifyEmail] no SMTP configuration available (neither SmtpSettings row nor NOTIFY_SMTP_* env vars) — skipping send.");
    await logDelivery(opts.to, opts.subject, false, "No SMTP configuration available");
    return;
  }
  const { host, port, username, password, from } = config;

  let socket: net.Socket | null = null;
  try {
    socket = port === 465 ? await connectTlsDirect(host, port) : await connectRaw(host, port);
    await readSmtpReply(socket);

    let ehloResp = await sendCmd(socket, "EHLO logmonitor.local\r\n");
    if (port !== 465 && /STARTTLS/i.test(ehloResp)) {
      const starttlsResp = await sendCmd(socket, "STARTTLS\r\n");
      if (replyCode(starttlsResp) === 220) {
        socket = await upgradeToTls(socket, host);
        ehloResp = await sendCmd(socket, "EHLO logmonitor.local\r\n");
      }
    }
    void ehloResp;

    const authResp = await sendCmd(socket, "AUTH LOGIN\r\n");
    if (replyCode(authResp) !== 334) throw new Error(`AUTH LOGIN rejected: ${authResp.trim()}`);
    const userResp = await sendCmd(socket, Buffer.from(username).toString("base64") + "\r\n");
    if (replyCode(userResp) !== 334) throw new Error(`Username rejected: ${userResp.trim()}`);
    const passResp = await sendCmd(socket, Buffer.from(password).toString("base64") + "\r\n");
    if (replyCode(passResp) !== 235) throw new Error(`Authentication failed: ${passResp.trim()}`);

    const mailFromResp = await sendCmd(socket, `MAIL FROM:<${from}>\r\n`);
    if (replyCode(mailFromResp) !== 250) throw new Error(`MAIL FROM rejected: ${mailFromResp.trim()}`);
    const rcptToResp = await sendCmd(socket, `RCPT TO:<${opts.to}>\r\n`);
    if (![250, 251].includes(replyCode(rcptToResp))) throw new Error(`RCPT TO rejected: ${rcptToResp.trim()}`);

    const dataResp = await sendCmd(socket, "DATA\r\n");
    if (replyCode(dataResp) !== 354) throw new Error(`DATA rejected: ${dataResp.trim()}`);

    const message = [`From: ${from}`, `To: ${opts.to}`, `Subject: ${opts.subject}`, `Date: ${new Date().toUTCString()}`, "", opts.body].join(
      "\r\n"
    );

    const finalResp = await sendCmd(socket, dotStuff(message) + "\r\n.\r\n");
    if (replyCode(finalResp) !== 250) throw new Error(`Message rejected: ${finalResp.trim()}`);

    socket.write("QUIT\r\n");
    socket.end();
    await logDelivery(opts.to, opts.subject, true);
  } catch (err) {
    if (socket) socket.destroy();
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[notifyEmail] failed to send to ${opts.to}:`, message);
    await logDelivery(opts.to, opts.subject, false, message);
  }
}
