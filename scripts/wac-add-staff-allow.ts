import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

// Adds a Staff-scoped Allow rule (same shape/columns/defaults as POST /api/admin/web-access-control/rules), so ONE staff
// member is unblocked for a domain while the Global/Group rule keeps applying to everyone else (rulesEngine.ts: an
// explicit staff-level Allow always outranks Global policy, regardless of priority).
// Usage: tsx scripts/wac-add-staff-allow.ts <staffId> <domain> <matchType: suffix|exact>
async function main() {
  const staffId = Number(process.argv[2]);
  const domain = process.argv[3]?.trim();
  const matchType = process.argv[4]?.trim() || "suffix";
  if (!Number.isInteger(staffId) || !domain || !["suffix", "exact"].includes(matchType)) {
    console.error("usage: wac-add-staff-allow.ts <staffId> <domain> [suffix|exact]");
    process.exit(2);
  }
  const db = await getDb();
  const staff = await db.request().input("id", sql.Int, staffId).query<{ Name: string }>("SELECT Name FROM Staff WHERE Id = @id");
  if (!staff.recordset[0]) {
    console.error("staff not found - nothing changed");
    process.exit(1);
  }

  const existing = await db
    .request()
    .input("staffId", sql.Int, staffId)
    .input("domain", sql.NVarChar, domain)
    .query("SELECT Id, Status FROM WacWebsiteRules WHERE ScopeType = 'Staff' AND StaffId = @staffId AND Domain = @domain AND Action = 'Allow'");
  if (existing.recordset.length > 0) {
    console.log(`A Staff Allow rule for ${domain} already exists for ${staff.recordset[0].Name} (Id ${existing.recordset[0].Id}, Status ${existing.recordset[0].Status}) - nothing changed.`);
    process.exit(0);
  }

  const inserted = await db
    .request()
    .input("domain", sql.NVarChar, domain)
    .input("matchType", sql.VarChar, matchType)
    .input("staffId", sql.Int, staffId)
    .query<{ Id: number }>(`
      INSERT INTO WacWebsiteRules (Domain, MatchType, Action, ScopeType, StaffId, WacGroupId, ScheduleId, Priority, Status, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@domain, @matchType, 'Allow', 'Staff', @staffId, NULL, NULL, 'High', 'Enabled', NULL, NULL)
    `);
  console.log(`Created Staff Allow rule Id ${inserted.recordset[0].Id}: ${domain} (${matchType}) for ${staff.recordset[0].Name} (StaffId ${staffId}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
