import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

// One-off: syncs the admin-editable CompanySettings row to match the new Tulips
// Command Center identity, so Settings > Branding/Company Profile shows the real
// current values instead of the old "Log Monitor" seed data. Self-deleting after use
// - same pattern as other one-off scripts this session.
async function main() {
  const db = await getDb();
  await db
    .request()
    .input("companyName", sql.NVarChar, "Tulips Unified Admin Center")
    .input("primaryColor", sql.VarChar, "#00C2FF")
    .input("secondaryColor", sql.VarChar, "#00B8A9")
    .input("loginTagline", sql.NVarChar, "Monitor • Secure • Manage • Automate")
    .query(`
      UPDATE CompanySettings SET
        CompanyName = @companyName,
        PrimaryColor = @primaryColor,
        SecondaryColor = @secondaryColor,
        LoginBrandingEnabled = 1,
        LoginTagline = @loginTagline,
        UpdatedAt = SYSUTCDATETIME()
      WHERE Id = 1
    `);

  const result = await db.query`SELECT CompanyName, PrimaryColor, SecondaryColor, LoginTagline FROM CompanySettings WHERE Id = 1`;
  console.log("CompanySettings row now:", result.recordset[0]);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
