import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

// Set (or clear) the agent release ONE device should update to, independent of the fleet-wide Agent Rollout target.
//   tsx scripts/set-device-target-version.ts --list <text>            show devices whose hostname/name/staff matches
//   tsx scripts/set-device-target-version.ts <text> agent-v0.17.0     set the target for the single matching device
//   tsx scripts/set-device-target-version.ts <text> --clear           go back to following the normal rollout
// Refuses to act unless exactly one device matches.
async function main() {
  const args = process.argv.slice(2);
  const listOnly = args[0] === "--list";
  const text = (listOnly ? args[1] : args[0])?.trim();
  const value = listOnly ? undefined : args[1]?.trim();
  if (!text || (!listOnly && !value)) {
    console.error("usage: set-device-target-version.ts --list <text> | <text> <agent-vX.Y.Z | --clear>");
    process.exit(2);
  }
  if (value && value !== "--clear" && !/^agent-v\d+\.\d+\.\d+$/.test(value)) {
    console.error(`"${value}" is not a release tag like agent-v0.17.0`);
    process.exit(2);
  }

  const db = await getDb();
  const rows = await db
    .request()
    .input("q", sql.NVarChar, `%${text}%`)
    .query<{ DeviceId: string; Hostname: string; DeviceName: string | null; DeviceType: string; OS: string | null; AgentVersion: string | null; AgentTargetVersion: string | null; StaffName: string | null; HbAge: number | null }>(
      `SELECT d.DeviceId, d.Hostname, d.DeviceName, d.DeviceType, d.OS, d.AgentVersion, d.AgentTargetVersion, st.Name AS StaffName,
         DATEDIFF(SECOND, d.LastHeartbeat, SYSUTCDATETIME()) AS HbAge
       FROM Devices d LEFT JOIN Staff st ON st.Id = d.StaffId
       WHERE d.Hostname LIKE @q OR d.DeviceName LIKE @q OR st.Name LIKE @q`
    );

  for (const r of rows.recordset) {
    console.log(`${r.Hostname} (${r.DeviceName ?? "-"}) staff=${r.StaffName ?? "-"} type=${r.DeviceType} os=${r.OS} agent=${r.AgentVersion} target=${r.AgentTargetVersion ?? "(fleet rollout)"} lastSeen=${r.HbAge}s id=${r.DeviceId}`);
  }
  if (listOnly) process.exit(0);
  if (rows.recordset.length !== 1) {
    console.error(`Expected exactly one matching device, found ${rows.recordset.length} - nothing changed.`);
    process.exit(1);
  }

  const target = value === "--clear" ? null : value!;
  await db.request().input("id", sql.VarChar, rows.recordset[0].DeviceId).input("v", sql.VarChar, target).query("UPDATE Devices SET AgentTargetVersion = @v WHERE DeviceId = @id");
  console.log(`${rows.recordset[0].Hostname}: target version ${target ?? "cleared (follows the fleet rollout)"}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
