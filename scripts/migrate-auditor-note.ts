import "dotenv/config";
import { getDb } from "../src/lib/db";

// Lets a Security Auditor (view+scan only, no status-change rights) record why a finding
// can't be fixed yet, without needing the admin-only status-change permission. Separate from
// WordPressFindings.Status / WordPressFindingStatusHistory.Reason (that trail stays admin-only).
async function main() {
  const db = await getDb();

  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('WordPressFindings') AND name = 'AuditorNote')
    ALTER TABLE WordPressFindings ADD AuditorNote NVARCHAR(500) NULL
  `);

  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('WebsiteAuditFindings') AND name = 'AuditorNote')
    ALTER TABLE WebsiteAuditFindings ADD AuditorNote NVARCHAR(500) NULL
  `);

  console.log("WordPressFindings.AuditorNote / WebsiteAuditFindings.AuditorNote ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
