import "dotenv/config";
import dgram from "dgram";
import dns from "dns";
import { getDb, sql } from "../src/lib/db";
import { parseSophosLog, extractFields } from "../src/lib/sophosParser";
import { parseMikrotikLog, isWebConnMessage, parseWebConn } from "../src/lib/mikrotikParser";

async function reverseDnsLookup(ip: string, timeoutMs = 1500): Promise<string | null> {
  try {
    const names = await Promise.race([
      dns.promises.reverse(ip),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    return names[0] ?? null;
  } catch {
    return null;
  }
}

const PORT = Number(process.env.SYSLOG_PORT || 5514);
const MIKROTIK_PORT = Number(process.env.MIKROTIK_SYSLOG_PORT || 5515);

const server = dgram.createSocket("udp4");
const mikrotikServer = dgram.createSocket("udp4");

async function handleWebFilter(raw: string, p: ReturnType<typeof parseSophosLog>) {
  const db = await getDb();
  await db
    .request()
    .input("logDate", sql.VarChar, p.logDate)
    .input("logTime", sql.VarChar, p.logTime)
    .input("deviceName", sql.NVarChar, p.deviceName)
    .input("srcIp", sql.VarChar, p.srcIp)
    .input("dstIp", sql.VarChar, p.dstIp)
    .input("srcPort", sql.Int, p.srcPort)
    .input("dstPort", sql.Int, p.dstPort)
    .input("protocol", sql.VarChar, p.protocol)
    .input("httpMethod", sql.VarChar, p.httpMethod)
    .input("url", sql.NVarChar, p.url)
    .input("domain", sql.NVarChar, p.domain)
    .input("category", sql.NVarChar, p.category)
    .input("categoryType", sql.NVarChar, p.categoryType)
    .input("action", sql.NVarChar, p.action)
    .input("userName", sql.NVarChar, p.userName)
    .input("logType", sql.NVarChar, p.logType)
    .input("logComponent", sql.NVarChar, p.logComponent)
    .input("logSubtype", sql.NVarChar, p.logSubtype)
    .input("rawMessage", sql.NVarChar, raw)
    .query(`
      INSERT INTO WebFilterLogs
        (LogDate, LogTime, DeviceName, SrcIp, DstIp, SrcPort, DstPort, Protocol,
         HttpMethod, Url, Domain, Category, CategoryType, Action, UserName,
         LogType, LogComponent, LogSubtype, RawMessage)
      VALUES
        (@logDate, @logTime, @deviceName, @srcIp, @dstIp, @srcPort, @dstPort, @protocol,
         @httpMethod, @url, @domain, @category, @categoryType, @action, @userName,
         @logType, @logComponent, @logSubtype, @rawMessage)
    `);
}

async function handleSystemHealth(raw: string, fields: Record<string, string>) {
  let logDate: string | null = fields.date ?? null;
  let logTime: string | null = fields.time ?? null;
  if (!logDate && fields.timestamp) {
    const [d, t] = fields.timestamp.split("T");
    logDate = d ?? null;
    logTime = t ? t.replace(/[+-]\d{4}$/, "") : null;
  }

  const db = await getDb();
  await db
    .request()
    .input("logDate", sql.VarChar, logDate)
    .input("logTime", sql.VarChar, logTime)
    .input("deviceName", sql.NVarChar, fields.device_name ?? null)
    .input("logComponent", sql.NVarChar, fields.log_component ?? null)
    .input("logSubtype", sql.NVarChar, fields.log_subtype ?? null)
    .input("fieldsJson", sql.NVarChar, JSON.stringify(fields))
    .input("rawMessage", sql.NVarChar, raw)
    .query(`
      INSERT INTO SystemHealthLogs
        (LogDate, LogTime, DeviceName, LogComponent, LogSubtype, Fields, RawMessage)
      VALUES
        (@logDate, @logTime, @deviceName, @logComponent, @logSubtype, @fieldsJson, @rawMessage)
    `);
}

// Sophos "Events" log type covers Admin/Authentication/System sub-categories
// (distinguished by log_component) — admin console changes, firewall login/logout
// (including the user portal/captive portal), and system-level events like reboots or
// HA failover. Previously silently dropped by this listener.
async function handleSophosEvent(raw: string, fields: Record<string, string>) {
  let logDate: string | null = fields.date ?? null;
  let logTime: string | null = fields.time ?? null;
  if (!logDate && fields.timestamp) {
    const [d, t] = fields.timestamp.split("T");
    logDate = d ?? null;
    logTime = t ? t.replace(/[+-]\d{4}$/, "") : null;
  }

  const db = await getDb();
  await db
    .request()
    .input("logDate", sql.VarChar, logDate)
    .input("logTime", sql.VarChar, logTime)
    .input("deviceName", sql.NVarChar, fields.device_name ?? null)
    .input("logComponent", sql.NVarChar, fields.log_component ?? null)
    .input("logSubtype", sql.NVarChar, fields.log_subtype ?? null)
    .input("fieldsJson", sql.NVarChar, JSON.stringify(fields))
    .input("rawMessage", sql.NVarChar, raw)
    .query(`
      INSERT INTO SophosEventLogs
        (LogDate, LogTime, DeviceName, LogComponent, LogSubtype, Fields, RawMessage)
      VALUES
        (@logDate, @logTime, @deviceName, @logComponent, @logSubtype, @fieldsJson, @rawMessage)
    `);
}

async function handleRouterLog(raw: string) {
  const p = parseMikrotikLog(raw);
  const db = await getDb();
  await db
    .request()
    .input("deviceTimestamp", sql.DateTime2, p.deviceTimestamp)
    .input("hostname", sql.NVarChar, p.hostname)
    .input("facility", sql.NVarChar, p.facility)
    .input("severity", sql.NVarChar, p.severity)
    .input("message", sql.NVarChar, p.message)
    .input("rawMessage", sql.NVarChar, raw)
    .query(`
      INSERT INTO RouterLogs (DeviceTimestamp, Hostname, Facility, Severity, Message, RawMessage)
      VALUES (@deviceTimestamp, @hostname, @facility, @severity, @message, @rawMessage)
    `);
}

async function handleRouterWebConn(raw: string, deviceTimestamp: Date | null, message: string) {
  const conn = parseWebConn(message);
  const reverseDns = conn.dstIp ? await reverseDnsLookup(conn.dstIp) : null;

  const db = await getDb();
  await db
    .request()
    .input("deviceTimestamp", sql.DateTime2, deviceTimestamp)
    .input("srcIp", sql.VarChar, conn.srcIp)
    .input("srcPort", sql.Int, conn.srcPort)
    .input("srcMac", sql.VarChar, conn.srcMac)
    .input("dstIp", sql.VarChar, conn.dstIp)
    .input("dstPort", sql.Int, conn.dstPort)
    .input("protocol", sql.VarChar, conn.protocol)
    .input("reverseDns", sql.NVarChar, reverseDns)
    .input("rawMessage", sql.NVarChar, raw)
    .query(`
      INSERT INTO RouterWebLogs
        (DeviceTimestamp, SrcIp, SrcPort, SrcMac, DstIp, DstPort, Protocol, ReverseDns, RawMessage)
      VALUES
        (@deviceTimestamp, @srcIp, @srcPort, @srcMac, @dstIp, @dstPort, @protocol, @reverseDns, @rawMessage)
    `);
}

server.on("message", async (msg, rinfo) => {
  const raw = msg.toString("utf8").trim();
  if (!raw) return;

  try {
    const fields = extractFields(raw);
    const logType = fields.log_type ?? null;
    const logComponent = fields.log_component ?? null;

    if (logType === "Content Filtering" && logComponent === "HTTP") {
      await handleWebFilter(raw, parseSophosLog(raw));
    } else if (logType === "System Health") {
      await handleSystemHealth(raw, fields);
    } else if (logType === "Events") {
      await handleSophosEvent(raw, fields);
    }
    // Other log types (Firewall, IPS, etc.) are still ignored for now.
  } catch (err) {
    console.error(`Failed to process syslog message from ${rinfo.address}:`, err);
    console.error("Raw message:", raw);
  }
});

mikrotikServer.on("message", async (msg, rinfo) => {
  const raw = msg.toString("utf8").trim();
  if (!raw) return;

  try {
    const p = parseMikrotikLog(raw);
    if (isWebConnMessage(p.message)) {
      await handleRouterWebConn(raw, p.deviceTimestamp, p.message!);
    } else {
      await handleRouterLog(raw);
    }
  } catch (err) {
    console.error(`Failed to process MikroTik syslog message from ${rinfo.address}:`, err);
    console.error("Raw message:", raw);
  }
});

server.on("error", (err) => {
  console.error("UDP server error:", err);
});

mikrotikServer.on("error", (err) => {
  console.error("MikroTik UDP server error:", err);
});

server.bind(PORT, () => {
  console.log(`Sophos syslog UDP listener running on port ${PORT}`);
});

mikrotikServer.bind(MIKROTIK_PORT, () => {
  console.log(`MikroTik syslog UDP listener running on port ${MIKROTIK_PORT}`);
});
