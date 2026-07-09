import "dotenv/config";
import snmp from "net-snmp";
import { exec } from "child_process";
import { promisify } from "util";
import { getDb, sql } from "../src/lib/db";
import { classifyOS } from "../src/lib/deviceType";

const execAsync = promisify(exec);

const INTERVAL_MS = Number(process.env.SOPHOS_POLL_INTERVAL_MS || 120000);
const SNMP_HOST = process.env.SOPHOS_SNMP_HOST || "192.168.1.1";
const SNMP_COMMUNITY = process.env.SOPHOS_SNMP_COMMUNITY || "public";
const LAN_PREFIX = process.env.SOPHOS_LAN_PREFIX || "192.168.1.";

// The Sophos firewall itself sees ARP for every device on the LAN (not just ones that
// happen to talk to our one server), so walking its SNMP ARP table gives far better
// coverage than local ping+ARP. ipNetToMediaPhysAddress is the standard MIB-II ARP table.
const ARP_OID = "1.3.6.1.2.1.4.22.1.2";

function walkArpTable(): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    const session = snmp.createSession(SNMP_HOST, SNMP_COMMUNITY, { timeout: 5000, retries: 1 });
    const map = new Map<string, string>();

    session.subtree(
      ARP_OID,
      (varbinds: { oid: string; value: Buffer }[]) => {
        for (const vb of varbinds) {
          if (snmp.isVarbindError(vb)) continue;
          const macBytes = Buffer.from(vb.value);
          if (macBytes.length !== 6) continue;
          const mac = [...macBytes].map((b) => b.toString(16).padStart(2, "0")).join(":").toUpperCase();
          const parts = vb.oid.split(".");
          const ip = parts.slice(-4).join(".");
          if (ip.startsWith(LAN_PREFIX)) {
            map.set(ip, mac);
          }
        }
      },
      (error: Error | null) => {
        session.close();
        if (error) reject(error);
        else resolve(map);
      }
    );
  });
}

// Our server is on the same LAN, so `ping -a` resolves a NetBIOS/DNS hostname for
// Windows devices in one shot ("Pinging HOSTNAME [ip] ..."). Non-Windows devices
// (phones, etc.) just won't resolve — that's expected, not an error. The same reply
// also carries a TTL, which doubles as a rough OS fingerprint (see classifyOS).
async function pingProbe(ip: string): Promise<{ hostname: string | null; ttl: number | null }> {
  try {
    const { stdout } = await execAsync(`ping -a -n 1 -w 300 ${ip}`);
    const nameMatch = /^Pinging\s+(\S+)\s+\[([\d.]+)\]/m.exec(stdout);
    const hostname = nameMatch && nameMatch[1] !== nameMatch[2] ? nameMatch[1] : null;
    const ttlMatch = /TTL=(\d+)/i.exec(stdout);
    const ttl = ttlMatch ? Number(ttlMatch[1]) : null;
    return { hostname, ttl };
  } catch {
    return { hostname: null, ttl: null };
  }
}

async function pollOnce() {
  const db = await getDb();
  const arpMap = await walkArpTable();

  let hostnamesResolved = 0;
  for (const [ip, mac] of arpMap) {
    const { hostname, ttl } = await pingProbe(ip);
    if (hostname) hostnamesResolved++;
    const os = classifyOS(hostname, ttl);

    await db
      .request()
      .input("ip", sql.VarChar, ip)
      .input("mac", sql.VarChar, mac)
      .input("hostname", sql.NVarChar, hostname)
      .input("os", sql.NVarChar, os)
      .query(`
        MERGE SophosClients AS target
        USING (SELECT @ip AS IpAddress) AS src
        ON target.IpAddress = src.IpAddress
        WHEN MATCHED THEN UPDATE SET MacAddress = @mac, UpdatedAt = SYSUTCDATETIME(),
          Hostname = COALESCE(@hostname, target.Hostname), Os = @os
        WHEN NOT MATCHED THEN INSERT (IpAddress, MacAddress, Hostname, Os, FirstSeen)
          VALUES (@ip, @mac, @hostname, @os, SYSUTCDATETIME());
      `);
  }

  console.log(
    `[${new Date().toISOString()}] SNMP ARP walk resolved ${arpMap.size} devices on ${LAN_PREFIX}0/24, ${hostnamesResolved} hostnames.`
  );
}

async function loop() {
  try {
    await pollOnce();
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to poll Sophos clients via SNMP:`, err);
  }
  setTimeout(loop, INTERVAL_MS);
}

loop();
