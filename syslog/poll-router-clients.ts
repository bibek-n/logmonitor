import "dotenv/config";
import { NodeSSH } from "node-ssh";
import { exec } from "child_process";
import { promisify } from "util";
import { getDb, sql } from "../src/lib/db";
import {
  parseMonitorTraffic,
  parseSystemResource,
  parseSystemHealth,
  parseInterfaceList,
  parseActiveUsers,
} from "../src/lib/mikrotikParser";
import { classifyOS } from "../src/lib/deviceType";

const execAsync = promisify(exec);

const HOST = process.env.ROUTER_HOST!;
const USER = process.env.ROUTER_USER!;
const PASSWORD = process.env.ROUTER_PASSWORD!;
const INTERVAL_MS = Number(process.env.ROUTER_POLL_INTERVAL_MS || 120000);

const KV_REGEX = /(\S+?)=(?:"([^"]*)"|(\S*))/g;

interface Lease {
  address: string;
  macAddress: string | null;
  hostname: string | null;
  status: string | null;
  lastSeen: string | null;
  expiresAfter: string | null;
}

function parseLeaseLine(line: string): Lease | null {
  const fields: Record<string, string> = {};
  let match: RegExpExecArray | null;
  KV_REGEX.lastIndex = 0;
  while ((match = KV_REGEX.exec(line)) !== null) {
    const key = match[1];
    const value = match[2] !== undefined ? match[2] : match[3] ?? "";
    fields[key] = value;
  }
  if (!fields.address) return null;
  return {
    address: fields.address,
    macAddress: fields["mac-address"] ?? null,
    hostname: fields["host-name"] ?? null,
    status: fields.status ?? null,
    lastSeen: fields["last-seen"] ?? null,
    expiresAfter: fields["expires-after"] ?? null,
  };
}

interface TrafficRow {
  srcAddress: string;
  dstAddress: string;
  packets: number;
  bytes: number;
}

// /ip accounting snapshot print terse - same "key=value" format as the lease list, reuses
// KV_REGEX. "/ip accounting snapshot take" (run right before this) both copies the live
// per-flow counters into the snapshot AND clears the live table, so each poll's rows are a
// delta since the previous poll, not a cumulative running total.
function parseAccountingLine(line: string): TrafficRow | null {
  const fields: Record<string, string> = {};
  let match: RegExpExecArray | null;
  KV_REGEX.lastIndex = 0;
  while ((match = KV_REGEX.exec(line)) !== null) {
    const key = match[1];
    const value = match[2] !== undefined ? match[2] : match[3] ?? "";
    fields[key] = value;
  }
  if (!fields["src-address"] || !fields["dst-address"]) return null;
  return {
    srcAddress: fields["src-address"],
    dstAddress: fields["dst-address"],
    packets: Number(fields.packets ?? 0),
    bytes: Number(fields.bytes ?? 0),
  };
}

// Our server is routed to the MikroTik LAN too, so we can ping each lease directly.
// The TTL doubles as a rough OS fingerprint — see classifyOS.
async function pingTtl(ip: string): Promise<number | null> {
  try {
    const { stdout } = await execAsync(`ping -n 1 -w 500 ${ip}`);
    const match = /TTL=(\d+)/i.exec(stdout);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

async function pollOnce() {
  const ssh = new NodeSSH();
  try {
    await ssh.connect({ host: HOST, username: USER, password: PASSWORD, tryKeyboard: false });
    const result = await ssh.execCommand("/ip dhcp-server lease print terse");
    const lines = result.stdout.split("\n").map((l) => l.trim()).filter(Boolean);

    const db = await getDb();
    for (const line of lines) {
      const lease = parseLeaseLine(line);
      if (!lease) continue;

      const ttl = lease.status === "bound" ? await pingTtl(lease.address) : null;
      const os = classifyOS(lease.hostname, ttl);

      await db
        .request()
        .input("ip", sql.VarChar, lease.address)
        .input("mac", sql.VarChar, lease.macAddress)
        .input("hostname", sql.NVarChar, lease.hostname)
        .input("status", sql.NVarChar, lease.status)
        .input("lastSeen", sql.NVarChar, lease.lastSeen)
        .input("expiresAfter", sql.NVarChar, lease.expiresAfter)
        .input("os", sql.NVarChar, os)
        .query(`
          MERGE RouterClients AS target
          USING (SELECT @ip AS IpAddress) AS src
          ON target.IpAddress = src.IpAddress
          WHEN MATCHED THEN UPDATE SET
            MacAddress = @mac,
            Hostname = @hostname,
            Status = @status,
            LastSeenRaw = @lastSeen,
            ExpiresAfterRaw = @expiresAfter,
            Os = @os,
            UpdatedAt = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT
            (IpAddress, MacAddress, Hostname, Status, LastSeenRaw, ExpiresAfterRaw, Os, FirstSeen)
            VALUES (@ip, @mac, @hostname, @status, @lastSeen, @expiresAfter, @os, SYSUTCDATETIME());
        `);
    }
    console.log(`[${new Date().toISOString()}] Polled ${lines.length} router client leases.`);

    // Fetched once and reused for both bandwidth polling and the RouterInterfaces upsert
    // below, so every interface the router actually reports gets a bandwidth history -
    // not just a hardcoded subset. monitor-traffic is queried one interface at a time
    // (not comma-joined) because a multi-interface call produces a misaligned column
    // layout - see parseMonitorTraffic's comment in mikrotikParser.ts.
    const ifaceResult = await ssh.execCommand("/interface print terse");
    const interfaces = parseInterfaceList(ifaceResult.stdout);

    let bandwidthCount = 0;
    for (const iface of interfaces) {
      const trafficResult = await ssh.execCommand(`/interface monitor-traffic interface=${iface.name} once`);
      const rate = parseMonitorTraffic(trafficResult.stdout);
      if (rate.rxMbps === null && rate.txMbps === null) continue;

      await db
        .request()
        .input("interface", sql.NVarChar, rate.interface ?? iface.name)
        .input("rxMbps", sql.Decimal(10, 3), rate.rxMbps)
        .input("txMbps", sql.Decimal(10, 3), rate.txMbps)
        .query(`INSERT INTO RouterBandwidth (Interface, RxMbps, TxMbps) VALUES (@interface, @rxMbps, @txMbps)`);
      bandwidthCount++;
    }
    console.log(`[${new Date().toISOString()}] Polled bandwidth for ${bandwidthCount} interfaces.`);

    const resourceResult = await ssh.execCommand("/system resource print");
    const healthResult = await ssh.execCommand("/system health print");
    const resource = parseSystemResource(resourceResult.stdout);
    const health = parseSystemHealth(healthResult.stdout);

    await db
      .request()
      .input("uptimeSeconds", sql.BigInt, resource.uptimeSeconds)
      .input("version", sql.NVarChar, resource.version)
      .input("boardName", sql.NVarChar, resource.boardName)
      .input("cpuLoadPct", sql.Float, resource.cpuLoadPct)
      .input("cpuCount", sql.Int, resource.cpuCount)
      .input("cpuFrequencyMhz", sql.Float, resource.cpuFrequencyMhz)
      .input("freeMemoryMB", sql.Float, resource.freeMemoryMB)
      .input("totalMemoryMB", sql.Float, resource.totalMemoryMB)
      .input("freeDiskMB", sql.Float, resource.freeDiskMB)
      .input("totalDiskMB", sql.Float, resource.totalDiskMB)
      .input("temperature", sql.Float, health.temperature)
      .input("voltage", sql.Float, health.voltage)
      .query(`
        INSERT INTO RouterHealth (
          UptimeSeconds, Version, BoardName, CpuLoadPct, CpuCount, CpuFrequencyMhz,
          FreeMemoryMB, TotalMemoryMB, FreeDiskMB, TotalDiskMB, Temperature, Voltage
        ) VALUES (
          @uptimeSeconds, @version, @boardName, @cpuLoadPct, @cpuCount, @cpuFrequencyMhz,
          @freeMemoryMB, @totalMemoryMB, @freeDiskMB, @totalDiskMB, @temperature, @voltage
        )
      `);
    console.log(`[${new Date().toISOString()}] Polled router health (CPU ${resource.cpuLoadPct ?? "?"}%, temp ${health.temperature ?? "?"}C).`);

    for (const iface of interfaces) {
      await db
        .request()
        .input("name", sql.NVarChar, iface.name)
        .input("defaultName", sql.NVarChar, iface.defaultName)
        .input("type", sql.NVarChar, iface.type)
        .input("running", sql.Bit, iface.running)
        .input("disabled", sql.Bit, iface.disabled)
        .input("slave", sql.Bit, iface.slave)
        .input("mtu", sql.NVarChar, iface.mtu)
        .input("macAddress", sql.VarChar, iface.macAddress)
        .input("comment", sql.NVarChar, iface.comment)
        .input("lastLinkUpTime", sql.DateTime2, iface.lastLinkUpTime)
        .input("lastLinkDownTime", sql.DateTime2, iface.lastLinkDownTime)
        .input("linkDowns", sql.Int, iface.linkDowns)
        .query(`
          MERGE RouterInterfaces AS target
          USING (SELECT @name AS Name) AS src
          ON target.Name = src.Name
          WHEN MATCHED THEN UPDATE SET
            DefaultName = @defaultName, Type = @type, Running = @running, Disabled = @disabled,
            Slave = @slave, Mtu = @mtu, MacAddress = @macAddress, Comment = @comment,
            LastLinkUpTime = @lastLinkUpTime, LastLinkDownTime = @lastLinkDownTime,
            LinkDowns = @linkDowns, UpdatedAt = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT
            (Name, DefaultName, Type, Running, Disabled, Slave, Mtu, MacAddress, Comment,
             LastLinkUpTime, LastLinkDownTime, LinkDowns)
            VALUES (@name, @defaultName, @type, @running, @disabled, @slave, @mtu, @macAddress,
             @comment, @lastLinkUpTime, @lastLinkDownTime, @linkDowns);
        `);
    }
    console.log(`[${new Date().toISOString()}] Polled ${interfaces.length} router interfaces.`);

    // Take-and-clear the IP accounting snapshot for per-client traffic (Top Router Clients on
    // the Top Consumers page) - "/ip accounting" itself was enabled once out-of-band
    // (`/ip accounting set enabled=yes account-local-traffic=yes threshold=256`) since it
    // defaults to off; RouterOS persists that setting across reboots, no need to re-set it here.
    await ssh.execCommand("/ip accounting snapshot take");
    const acctResult = await ssh.execCommand("/ip accounting snapshot print terse");
    const acctLines = acctResult.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
    let trafficRows = 0;
    for (const line of acctLines) {
      const row = parseAccountingLine(line);
      if (!row) continue;
      await db
        .request()
        .input("src", sql.VarChar, row.srcAddress)
        .input("dst", sql.VarChar, row.dstAddress)
        .input("packets", sql.BigInt, row.packets)
        .input("bytes", sql.BigInt, row.bytes)
        .query("INSERT INTO RouterClientTraffic (SrcAddress, DstAddress, Packets, Bytes) VALUES (@src, @dst, @packets, @bytes)");
      trafficRows++;
    }
    console.log(`[${new Date().toISOString()}] Polled ${trafficRows} IP accounting traffic rows.`);

    const usersResult = await ssh.execCommand("/user active print terse");
    const activeUsers = parseActiveUsers(usersResult.stdout);
    await db.query("DELETE FROM RouterActiveUsers");
    for (const user of activeUsers) {
      await db
        .request()
        .input("name", sql.NVarChar, user.name)
        .input("address", sql.VarChar, user.address)
        .input("via", sql.NVarChar, user.via)
        .input("loginTime", sql.DateTime2, user.loginTime)
        .query("INSERT INTO RouterActiveUsers (Name, Address, Via, LoginTime) VALUES (@name, @address, @via, @loginTime)");
    }
    console.log(`[${new Date().toISOString()}] Polled ${activeUsers.length} active router users.`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to poll router clients:`, err);
  } finally {
    ssh.dispose();
  }
}

async function loop() {
  await pollOnce();
  setTimeout(loop, INTERVAL_MS);
}

loop();
