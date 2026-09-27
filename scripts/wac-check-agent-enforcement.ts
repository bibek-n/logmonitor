import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import { getBlockedDomainsForStaff } from "../src/lib/webAccessControl/enforcement";

// Read-only: runs the REAL heartbeat logic (getBlockedDomainsForStaff, gated the same way as
// app/api/agent/heartbeat/route.ts) for the device belonging to <staffId>, so you can see exactly what the agent's
// hosts-file blocking (agent/wacblock_windows.go) is being told right now, and whether it will actually get there
// (device online + WebsiteBlockingEnabled). Usage: tsx scripts/wac-check-agent-enforcement.ts <staffId>
async function main() {
  const staffId = Number(process.argv[2]);
  if (!Number.isInteger(staffId)) {
    console.error("usage: wac-check-agent-enforcement.ts <staffId>");
    process.exit(2);
  }
  const db = await getDb();
  const dev = await db
    .request()
    .input("id", sql.Int, staffId)
    .query<{ Hostname: string; WebsiteBlockingEnabled: boolean | null; HbAge: number | null; AgentVersion: string | null }>(
      `SELECT d.Hostname, d.WebsiteBlockingEnabled, DATEDIFF(SECOND, d.LastHeartbeat, SYSUTCDATETIME()) AS HbAge, d.AgentVersion
       FROM Devices d WHERE d.StaffId = @id`
    );
  const d = dev.recordset[0];
  if (!d) {
    console.log("No device is linked to this staff member.");
    process.exit(0);
  }
  const online = d.HbAge !== null && d.HbAge < 300;
  console.log(`Device: ${d.Hostname}  online=${online} (last heartbeat ${d.HbAge}s ago)  WebsiteBlockingEnabled=${d.WebsiteBlockingEnabled}  agent=${d.AgentVersion}`);

  if (!d.WebsiteBlockingEnabled) {
    console.log("WebsiteBlockingEnabled is OFF for this device -> the agent enforces NOTHING (no domains are ever sent), regardless of any rule.");
    process.exit(0);
  }
  const blocked = await getBlockedDomainsForStaff(staffId);
  console.log(`Domains this device is currently told to block (same list a real heartbeat gets right now): ${JSON.stringify(blocked)}`);
  if (!online) {
    console.log("NOTE: this device has not heartbeated in the last 5 minutes, so it has not yet received this updated list - it is running on whatever list its last heartbeat delivered.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
