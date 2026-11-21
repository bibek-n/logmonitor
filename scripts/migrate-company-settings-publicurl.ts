import "dotenv/config";
import { getDb } from "../src/lib/db";

// Adds the one field CompanySettings was missing for white-labeling: the app's own
// public-facing base URL (e.g. https://logs.customer.com), distinct from WebsiteUrl (the
// company's separate marketing site). This is what the Enroll page's install command should
// always use, instead of window.location.origin - the exact bug that pointed most of this
// company's own staff agents at the internal office IP (see EnrollClient.tsx).
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (
      SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CompanySettings') AND name = 'PublicUrl'
    )
    ALTER TABLE CompanySettings ADD PublicUrl NVARCHAR(500) NULL
  `;

  console.log("PublicUrl column ready on CompanySettings.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
