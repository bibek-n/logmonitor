import dns from "dns";
import net from "net";
import tls from "tls";

const dnsPromises = dns.promises;

const HOSTNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

export function isValidHost(input: string): boolean {
  if (!input || input.length > 253) return false;
  if (IPV4_RE.test(input)) return input.split(".").every((o) => Number(o) <= 255);
  return HOSTNAME_RE.test(input);
}

export function isValidIpv4(input: string): boolean {
  return IPV4_RE.test(input) && input.split(".").every((o) => Number(o) <= 255);
}

function testTcpConnect(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    socket.setTimeout(timeoutMs);
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

// --- MX Mail Server Test ---
export async function mxMailServerTest(domain: string): Promise<string> {
  let records;
  try {
    records = await dnsPromises.resolveMx(domain);
  } catch {
    return `No MX records found for ${domain}. Mail sent to this domain would have nowhere to go.`;
  }
  records.sort((a, b) => a.priority - b.priority);

  const lines = [`MX records for ${domain} (lowest priority = most preferred):`, ""];
  records.forEach((r) => lines.push(`Priority ${r.priority}: ${r.exchange}`));
  lines.push("", "Connectivity test (port 25, 5s timeout):");
  for (const r of records) {
    const reachable = await testTcpConnect(r.exchange, 25, 5000);
    lines.push(`  ${r.exchange}:25 — ${reachable ? "reachable" : "unreachable (may be normal if this network blocks outbound port 25)"}`);
  }
  return lines.join("\n");
}

// --- SMTP Server Test ---
export function readSmtpReply(socket: net.Socket, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const onData = (d: Buffer) => {
      buf += d.toString();
      const lines = buf.split("\r\n").filter(Boolean);
      const last = lines[lines.length - 1];
      if (last && /^\d{3} /.test(last)) {
        cleanup();
        resolve(buf);
      }
    };
    const onErr = (err: Error) => {
      cleanup();
      reject(err);
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error("Timed out waiting for a reply from the SMTP server."));
    };
    function cleanup() {
      socket.removeListener("data", onData);
      socket.removeListener("error", onErr);
      socket.removeListener("timeout", onTimeout);
    }
    socket.on("data", onData);
    socket.on("error", onErr);
    socket.on("timeout", onTimeout);
  });
}

export function smtpServerTest(host: string, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(10000);
    socket.once("error", (err) => reject(err));

    socket.once("connect", async () => {
      try {
        const banner = await readSmtpReply(socket);
        socket.write("EHLO logmonitor.local\r\n");
        const ehloResp = await readSmtpReply(socket);
        try {
          socket.write("QUIT\r\n");
        } catch {
          // connection may already be closing; ignore
        }
        socket.end();
        resolve(
          [
            `Connected to ${host}:${port}`,
            "",
            "Server Banner:",
            banner.trim(),
            "",
            "EHLO Response (supported extensions):",
            ehloResp.trim(),
          ].join("\n")
        );
      } catch (err) {
        socket.destroy();
        reject(err);
      }
    });
  });
}

// --- SPF, DKIM & DMARC Checker ---
const COMMON_DKIM_SELECTORS = ["default", "google", "selector1", "selector2", "k1", "mandrill", "dkim", "mail", "smtp", "s1", "s2"];

async function lookupTxt(name: string): Promise<string[]> {
  try {
    const records = await dnsPromises.resolveTxt(name);
    return records.map((r) => r.join(""));
  } catch {
    return [];
  }
}

export async function spfDkimDmarcCheck(domain: string, dkimSelector?: string): Promise<string> {
  const lines = [`Email authentication check for ${domain}:`, ""];

  lines.push("SPF:");
  const txt = await lookupTxt(domain);
  const spf = txt.filter((t) => t.startsWith("v=spf1"));
  if (spf.length) spf.forEach((s) => lines.push(`  ${s}`));
  else lines.push("  No SPF record found.");
  lines.push("");

  lines.push("DMARC:");
  const dmarcTxt = await lookupTxt(`_dmarc.${domain}`);
  const dmarc = dmarcTxt.filter((t) => t.startsWith("v=DMARC1"));
  if (dmarc.length) dmarc.forEach((s) => lines.push(`  ${s}`));
  else lines.push("  No DMARC record found.");
  lines.push("");

  lines.push("DKIM:");
  const selectors = dkimSelector ? [dkimSelector] : COMMON_DKIM_SELECTORS;
  let found = false;
  for (const sel of selectors) {
    const dkimTxt = await lookupTxt(`${sel}._domainkey.${domain}`);
    const val = dkimTxt.join("");
    if (val) {
      found = true;
      lines.push(`  [selector: ${sel}] ${val.length > 200 ? val.slice(0, 200) + "..." : val}`);
    }
  }
  if (!found) {
    lines.push(
      dkimSelector
        ? `  No DKIM record found for selector "${dkimSelector}".`
        : `  No DKIM record found for common selectors (${COMMON_DKIM_SELECTORS.join(", ")}). DKIM selectors aren't discoverable via DNS — if you know the exact selector your mail provider uses, enter it above.`
    );
  }

  return lines.join("\n");
}

// --- Email Delivery Test ---
export interface DeliveryTestOptions {
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  from: string;
  to: string;
}

// Raw SMTP conversation, deliberately not using nodemailer — under this app's Windows/iisnode
// hosting, nodemailer's async connection-error path was escaping our try/catch entirely and
// crashing the request (reproduced even against an unreachable host), while this app's own
// plain net/tls socket handling (same pattern as smtpServerTest) has proven reliable. Speaking
// the protocol directly also means every step's exact server response is visible for diagnosis.

// Exported so other callers (e.g. src/lib/notifyEmail.ts) can compose their own SMTP
// sends on top of these same proven-reliable primitives without duplicating the
// STARTTLS/AUTH LOGIN dance — these functions themselves are unchanged, just made
// available outside this module.
export function connectRaw(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(15000);
    socket.once("connect", () => resolve(socket));
    socket.once("error", (err) => reject(err));
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("Connection timed out."));
    });
  });
}

export function connectTlsDirect(host: string, port: number): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false });
    socket.setTimeout(15000);
    socket.once("secureConnect", () => resolve(socket));
    socket.once("error", (err) => reject(err));
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("Connection timed out."));
    });
  });
}

export function upgradeToTls(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: host, rejectUnauthorized: false }, () => resolve(secureSocket));
    secureSocket.once("error", (err) => reject(err));
  });
}

export async function sendCmd(socket: net.Socket, cmd: string): Promise<string> {
  socket.write(cmd);
  return readSmtpReply(socket);
}

export function replyCode(reply: string): number {
  const lines = reply.trim().split(/\r\n/);
  const match = /^(\d{3})/.exec(lines[lines.length - 1]);
  return match ? Number(match[1]) : 0;
}

export function dotStuff(text: string): string {
  return text
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? "." + line : line))
    .join("\r\n");
}

export async function emailDeliveryTest(opts: DeliveryTestOptions): Promise<string> {
  const { smtpHost: host, smtpPort: port, username, password, from, to } = opts;
  const steps: string[] = [];
  let socket: net.Socket | null = null;

  try {
    socket = port === 465 ? await connectTlsDirect(host, port) : await connectRaw(host, port);

    const banner = await readSmtpReply(socket);
    steps.push(`Connected. Banner: ${banner.trim()}`);

    let ehloResp = await sendCmd(socket, "EHLO logmonitor.local\r\n");
    steps.push(`EHLO: ${ehloResp.trim()}`);

    if (port !== 465 && /STARTTLS/i.test(ehloResp)) {
      const starttlsResp = await sendCmd(socket, "STARTTLS\r\n");
      steps.push(`STARTTLS: ${starttlsResp.trim()}`);
      if (replyCode(starttlsResp) === 220) {
        socket = await upgradeToTls(socket, host);
        ehloResp = await sendCmd(socket, "EHLO logmonitor.local\r\n");
        steps.push(`EHLO (after TLS): ${ehloResp.trim()}`);
      }
    }

    const authResp = await sendCmd(socket, "AUTH LOGIN\r\n");
    steps.push(`AUTH LOGIN: ${authResp.trim()}`);
    if (replyCode(authResp) !== 334) throw new Error(`Server did not accept AUTH LOGIN: ${authResp.trim()}`);

    const userResp = await sendCmd(socket, Buffer.from(username).toString("base64") + "\r\n");
    steps.push(`Username sent: ${userResp.trim()}`);
    if (replyCode(userResp) !== 334) throw new Error(`Server rejected the username: ${userResp.trim()}`);

    const passResp = await sendCmd(socket, Buffer.from(password).toString("base64") + "\r\n");
    steps.push(`Password sent: ${passResp.trim()}`);
    if (replyCode(passResp) !== 235) throw new Error(`Authentication failed: ${passResp.trim()}`);

    const mailFromResp = await sendCmd(socket, `MAIL FROM:<${from}>\r\n`);
    steps.push(`MAIL FROM: ${mailFromResp.trim()}`);
    if (replyCode(mailFromResp) !== 250) throw new Error(`MAIL FROM rejected: ${mailFromResp.trim()}`);

    const rcptToResp = await sendCmd(socket, `RCPT TO:<${to}>\r\n`);
    steps.push(`RCPT TO: ${rcptToResp.trim()}`);
    if (![250, 251].includes(replyCode(rcptToResp))) throw new Error(`RCPT TO rejected: ${rcptToResp.trim()}`);

    const dataResp = await sendCmd(socket, "DATA\r\n");
    steps.push(`DATA: ${dataResp.trim()}`);
    if (replyCode(dataResp) !== 354) throw new Error(`DATA command rejected: ${dataResp.trim()}`);

    const message = [
      `From: ${from}`,
      `To: ${to}`,
      "Subject: Test Email Delivery — Tulips Unified Admin Center",
      `Date: ${new Date().toUTCString()}`,
      "",
      `This is a test email sent from the Tulips Unified Admin Center's Email Delivery Test tool at ${new Date().toISOString()}.`,
    ].join("\r\n");

    const finalResp = await sendCmd(socket, dotStuff(message) + "\r\n.\r\n");
    steps.push(`Message sent: ${finalResp.trim()}`);
    if (replyCode(finalResp) !== 250) throw new Error(`Server rejected the message: ${finalResp.trim()}`);

    try {
      socket.write("QUIT\r\n");
    } catch {
      // connection may already be closing; not fatal to the result
    }
    socket.end();

    return [
      "✓ Email accepted by the SMTP server for delivery.",
      "",
      ...steps,
      "",
      "Note: acceptance by the SMTP server doesn't guarantee inbox delivery — check the destination mailbox (including spam) to confirm end-to-end delivery.",
    ].join("\n");
  } catch (err) {
    if (socket) socket.destroy();
    return [
      "✗ Delivery failed.",
      "",
      ...steps,
      "",
      `Error: ${err instanceof Error ? err.message : String(err)}`,
    ].join("\n");
  }
}

// --- DNSBL Spam Database Lookup ---
// A DNSBL lists offending IPs by encoding the reversed octets as a subdomain of the list's
// zone (e.g. 4.3.2.1.zen.spamhaus.org for IP 1.2.3.4). An A record back means "listed" —
// almost always 127.0.0.x, where the last octet indicates the listing reason on that list.
const DNSBL_ZONES = [
  { name: "Spamhaus ZEN", zone: "zen.spamhaus.org" },
  { name: "SpamCop", zone: "bl.spamcop.net" },
  { name: "Barracuda", zone: "b.barracudacentral.org" },
  { name: "SORBS", zone: "dnsbl.sorbs.net" },
  { name: "PSBL", zone: "psbl.surriel.com" },
];

export async function dnsblLookup(ip: string): Promise<string> {
  const reversed = ip.split(".").reverse().join(".");
  const lines = [`DNSBL lookup for ${ip}:`, ""];
  let anyListed = false;

  for (const { name, zone } of DNSBL_ZONES) {
    const query = `${reversed}.${zone}`;
    try {
      const results = await dnsPromises.resolve4(query);
      anyListed = true;
      lines.push(`[LISTED] ${name} (${zone}) -> ${results.join(", ")}`);
      const reason = (await lookupTxt(query)).join("; ");
      if (reason) lines.push(`    Reason: ${reason}`);
    } catch {
      lines.push(`[clean]  ${name} (${zone})`);
    }
  }

  lines.push("");
  lines.push(
    anyListed
      ? "⚠ This IP is listed on at least one DNSBL — likely to affect email deliverability and may cause receiving servers to reject or spam-folder mail from it."
      : "✓ Not listed on any of the checked DNSBLs."
  );
  return lines.join("\n");
}

// --- URIBL Spam Database Lookup ---
// Same lookup mechanism as DNSBL, but keyed on a domain name rather than an IP — these lists
// track domains found in spam content/links, independent of where the mail was sent from.
const URIBL_ZONES = [
  { name: "SURBL", zone: "multi.surbl.org" },
  { name: "URIBL", zone: "multi.uribl.com" },
  { name: "Spamhaus DBL", zone: "dbl.spamhaus.org" },
];

export async function uriblLookup(domain: string): Promise<string> {
  const lines = [`URIBL lookup for ${domain}:`, ""];
  let anyListed = false;

  for (const { name, zone } of URIBL_ZONES) {
    const query = `${domain}.${zone}`;
    try {
      const results = await dnsPromises.resolve4(query);
      anyListed = true;
      lines.push(`[LISTED] ${name} (${zone}) -> ${results.join(", ")}`);
    } catch {
      lines.push(`[clean]  ${name} (${zone})`);
    }
  }

  lines.push("");
  lines.push(
    anyListed
      ? "⚠ This domain is listed on at least one URIBL — links to it may get flagged, stripped, or cause the whole email to be blocked."
      : "✓ Not listed on any of the checked URIBLs."
  );
  return lines.join("\n");
}
