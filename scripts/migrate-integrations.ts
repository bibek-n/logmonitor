import "dotenv/config";
import { getDb } from "../src/lib/db";

// Config-storage only for Phase 1 — no live OAuth/API wiring. See src/lib/integrationsConfig.ts
// for the per-provider field shapes stored in ConfigJson.
const PROVIDER_KEYS = ["github", "gitlab", "jira", "slack", "teams", "google_workspace", "azure_ad", "webhook", "custom_api"];

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Integrations' AND xtype='U')
    CREATE TABLE Integrations (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      ProviderKey NVARCHAR(50) NOT NULL UNIQUE,
      Enabled BIT NOT NULL DEFAULT 0,
      ConfigJson NVARCHAR(MAX) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL
    )
  `;

  const existingResult = await db.query<{ ProviderKey: string }>`SELECT ProviderKey FROM Integrations`;
  const existingKeys = new Set(existingResult.recordset.map((r) => r.ProviderKey));
  const missing = PROVIDER_KEYS.filter((k) => !existingKeys.has(k));

  for (const key of missing) {
    await db.request().input("key", key).query("INSERT INTO Integrations (ProviderKey, Enabled) VALUES (@key, 0)");
  }
  if (missing.length > 0) {
    console.log(`Seeded ${missing.length} integration row(s): ${missing.join(", ")}`);
  }

  console.log("Integrations table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
