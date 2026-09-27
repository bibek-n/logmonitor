import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

// Read-only: find staff matching <name> and any WAC website rules that apply to them (their own Staff-scoped rules,
// any WacGroup rule for a group they belong to, and any Global rule) for a domain matching <domainText>.
// Usage: tsx scripts/wac-find-rule.ts <name> <domainText>
async function main() {
  const name = process.argv[2]?.trim();
  const domainText = (process.argv[3] ?? "facebook").trim();
  if (!name) {
    console.error("usage: wac-find-rule.ts <name> [domainText]");
    process.exit(2);
  }
  const db = await getDb();
  const staff = await db.request().input("q", sql.NVarChar, `%${name}%`).query<{ Id: number; Name: string; WacGroupId: number | null; WebsiteBlockingEnabled: boolean | null }>(
    `SELECT s.Id, s.Name, s.WacGroupId, d.WebsiteBlockingEnabled
     FROM Staff s LEFT JOIN Devices d ON d.StaffId = s.Id WHERE s.Name LIKE @q`
  );
  console.log(`Staff matching "${name}":`, JSON.stringify(staff.recordset));
  if (staff.recordset.length !== 1) {
    if (staff.recordset.length === 0) console.log("No match - try a shorter or different spelling.");
    process.exit(0);
  }
  const s = staff.recordset[0];

  const rules = await db
    .request()
    .input("staffId", sql.Int, s.Id)
    .input("groupId", sql.Int, s.WacGroupId)
    .input("q", sql.NVarChar, `%${domainText}%`)
    .query(`
      SELECT r.Id, r.Domain, r.MatchType, r.Action, r.ScopeType, r.StaffId, r.WacGroupId, g.Name AS GroupName, r.Priority, r.Status,
        CONVERT(VARCHAR(19), r.CreatedAt, 126) AS CreatedAt, u.Username AS CreatedBy
      FROM WacWebsiteRules r
      LEFT JOIN WacGroups g ON g.Id = r.WacGroupId
      LEFT JOIN Users u ON u.Id = r.CreatedByUserId
      WHERE r.Domain LIKE @q AND (
        (r.ScopeType = 'Staff' AND r.StaffId = @staffId) OR
        (r.ScopeType = 'Group' AND r.WacGroupId = @groupId) OR
        (r.ScopeType = 'Global')
      )
      ORDER BY r.ScopeType, r.Id`);
  console.log(`Rules matching "${domainText}" that apply to ${s.Name} (WacGroupId=${s.WacGroupId}, WebsiteBlockingEnabled=${s.WebsiteBlockingEnabled}):`);
  for (const r of rules.recordset) console.log(" ", JSON.stringify(r));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
