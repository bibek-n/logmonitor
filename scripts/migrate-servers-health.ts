import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Server health monitoring: real-time CPU/RAM/disk/network/uptime already flow through the
// existing DeviceMetrics table (this just adds disk latency alongside the columns already
// there); Windows Services already flow through DeviceServiceSnapshot. What's new here is
// disk latency, a boot-time watermark (used to detect reboots server-side by comparing
// against each metrics upload's computed boot time), and Windows Update status - all as
// additive columns on existing tables, no new tables needed.
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "DeviceMetrics", "DiskLatencyMs", "FLOAT NULL");

  const deviceColumns: [string, string][] = [
    ["LastBootTime", "DATETIME2 NULL"],
    ["LastWindowsUpdateAt", "DATETIME2 NULL"],
    ["RecentHotfixCount", "INT NULL"],
    ["RebootPending", "BIT NULL"],
  ];
  for (const [col, type] of deviceColumns) {
    await addColumnIfMissing(db, "Devices", col, type);
  }

  console.log("Server health schema ready (DeviceMetrics.DiskLatencyMs, Devices boot/update columns).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
