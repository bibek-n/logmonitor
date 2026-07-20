import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();
  const tables = await db.query`SELECT name FROM sysobjects WHERE xtype='U' AND name LIKE 'CodeQuality%' ORDER BY name`;
  console.log("Tables:", tables.recordset.map((r: { name: string }) => r.name).join(", "));

  const settings = await db.query`
    SELECT WeightComplexity, WeightDuplication, WeightDeadCode, WeightUnusedVariables, WeightUnusedFunctions, WeightCodingStandards
    FROM CodeQualitySettings WHERE Id = 1
  `;
  console.log("Settings row:", JSON.stringify(settings.recordset[0]));

  const rules = await db.query`SELECT COUNT(*) AS Cnt FROM CodeQualityRules`;
  console.log("Rule count:", rules.recordset[0].Cnt);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
