import net from "net";
import { getDb, sql } from "./db";
import { connectRaw, connectTlsDirect, upgradeToTls, sendCmd, replyCode, dotStuff, readSmtpReply } from "./emailTools";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface NotifyEmailOptions {
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

// RFC 5322 header values must be ASCII — a raw UTF-8 character (e.g. an em/en dash) in
// Subject is a spec violation that some receiving/anti-spam systems tolerate on a simple
// single-part message but reject or silently drop on a multipart one. RFC 2047
// "encoded-word" syntax is the correct fix, applied whenever the value isn't plain ASCII.
function encodeHeaderValue(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

// Builds either a plain single-part message (unchanged from before, aside from the header
// encoding fix above) or, when attachments are present, a multipart/mixed MIME message with
// one text part plus one base64-encoded part per attachment — hand-rolled to extend the
// existing raw-socket sender rather than pulling in nodemailer, which has a proven crash bug
// on this app's Windows/iisnode hosting.
function buildMessage(from: string, opts: NotifyEmailOptions): string {
  const headers = [`From: ${from}`, `To: ${opts.to}`, `Subject: ${encodeHeaderValue(opts.subject)}`, `Date: ${new Date().toUTCString()}`];

  if (!opts.attachments || opts.attachments.length === 0) {
    return [...headers, "Content-Type: text/plain; charset=\"utf-8\"", "Content-Transfer-Encoding: 8bit", "", opts.body].join("\r\n");
  }

  const boundary = `----logmonitor-${Date.now().toString(36)}`;
  const parts: string[] = [];
  parts.push(`--${boundary}`, "Content-Type: text/plain; charset=\"utf-8\"", "Content-Transfer-Encoding: 8bit", "", opts.body, "");

  for (const att of opts.attachments) {
    const base64 = att.content.toString("base64");
    const wrapped = base64.match(/.{1,76}/g)?.join("\r\n") ?? base64;
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.contentType}; name="${att.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${att.filename}"`,
      "",
      wrapped,
      ""
    );
  }
  parts.push(`--${boundary}--`);

  return [...headers, "MIME-Version: 1.0", `Content-Type: multipart/mixed; boundary="${boundary}"`, "", ...parts].join("\r\n");
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
export interface SendResult {
  success: boolean;
  error?: string;
}

export async function sendNotificationEmail(opts: NotifyEmailOptions): Promise<SendResult> {
  if (!(await notificationsEnabled())) {
    console.log(`[notifyEmail] notifications disabled — would have sent to ${opts.to}: "${opts.subject}"`);
    return { success: false, error: "Notifications disabled" };
  }

  const config = await resolveSmtpConfig();
  if (!config) {
    console.error("[notifyEmail] no SMTP configuration available (neither SmtpSettings row nor NOTIFY_SMTP_* env vars) — skipping send.");
    await logDelivery(opts.to, opts.subject, false, "No SMTP configuration available");
    return { success: false, error: "No SMTP configuration available" };
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
    // The message body may contain raw UTF-8 (subject/body text with an em/en dash, etc.) —
    // BODY=8BITMIME tells the server that's expected, instead of silently sending 8-bit
    // data over a connection nominally negotiated as 7bit.
    const supports8BitMime = /8BITMIME/i.test(ehloResp);

    const authResp = await sendCmd(socket, "AUTH LOGIN\r\n");
    if (replyCode(authResp) !== 334) throw new Error(`AUTH LOGIN rejected: ${authResp.trim()}`);
    const userResp = await sendCmd(socket, Buffer.from(username).toString("base64") + "\r\n");
    if (replyCode(userResp) !== 334) throw new Error(`Username rejected: ${userResp.trim()}`);
    const passResp = await sendCmd(socket, Buffer.from(password).toString("base64") + "\r\n");
    if (replyCode(passResp) !== 235) throw new Error(`Authentication failed: ${passResp.trim()}`);

    const mailFromResp = await sendCmd(socket, `MAIL FROM:<${from}>${supports8BitMime ? " BODY=8BITMIME" : ""}\r\n`);
    if (replyCode(mailFromResp) !== 250) throw new Error(`MAIL FROM rejected: ${mailFromResp.trim()}`);

    // opts.to may be a comma-separated list (e.g. the two Website Security Audit report
    // recipients) — one RCPT TO per address, same message body/attachments for all of them.
    const recipients = opts.to.split(",").map((addr) => addr.trim()).filter(Boolean);
    for (const recipient of recipients) {
      const rcptToResp = await sendCmd(socket, `RCPT TO:<${recipient}>\r\n`);
      if (![250, 251].includes(replyCode(rcptToResp))) throw new Error(`RCPT TO rejected for ${recipient}: ${rcptToResp.trim()}`);
    }

    const dataResp = await sendCmd(socket, "DATA\r\n");
    if (replyCode(dataResp) !== 354) throw new Error(`DATA rejected: ${dataResp.trim()}`);

    const message = buildMessage(from, opts);

    const finalResp = await sendCmd(socket, dotStuff(message) + "\r\n.\r\n");
    if (replyCode(finalResp) !== 250) throw new Error(`Message rejected: ${finalResp.trim()}`);

    socket.write("QUIT\r\n");
    socket.end();
    await logDelivery(opts.to, opts.subject, true);
    return { success: true };
  } catch (err) {
    if (socket) socket.destroy();
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[notifyEmail] failed to send to ${opts.to}:`, message);
    await logDelivery(opts.to, opts.subject, false, message);
    return { success: false, error: message };
  }
}
