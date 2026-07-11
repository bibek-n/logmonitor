import "dotenv/config";
import { getDb } from "../src/lib/db";

// Single-row table — there is only ever one network diagram (Id = 1), same "one config
// blob" shape as Integrations but without a key column since there's nothing to key on.
// IMPORTANT: only a generic placeholder is seeded here. The real production topology
// (real IPs/hostnames/ISP name) must never be committed to this public repo — it is
// entered once by hand through the Edit UI directly on production, the same way the
// static page this replaces was deployed without ever being committed.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='NetworkDiagrams' AND xtype='U')
    CREATE TABLE NetworkDiagrams (
      Id INT NOT NULL PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL DEFAULT 'Enterprise Network Topology',
      DiagramJson NVARCHAR(MAX) NULL,
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedByUserId INT NULL
    )
  `;

  const existing = await db.query<{ Id: number }>`SELECT Id FROM NetworkDiagrams WHERE Id = 1`;
  if (existing.recordset.length === 0) {
    await db.query`INSERT INTO NetworkDiagrams (Id, Name, DiagramJson) VALUES (1, 'Enterprise Network Topology', NULL)`;
    console.log("Seeded empty NetworkDiagrams row (Id=1) — populate the real topology via Edit mode on production.");
  }

  console.log("NetworkDiagrams table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
