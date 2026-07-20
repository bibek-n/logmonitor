import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();
  const projects = await db.query`SELECT COUNT(*) AS Cnt FROM QaProjects WHERE Name LIKE '__vitest%'`;
  const modules = await db.query`SELECT COUNT(*) AS Cnt FROM QaModules WHERE Name LIKE '__vitest%'`;
  const suites = await db.query`SELECT COUNT(*) AS Cnt FROM QaTestSuites WHERE Name LIKE '__vitest%'`;
  const cases = await db.query`SELECT COUNT(*) AS Cnt FROM QaTestCases WHERE Title LIKE '__vitest%'`;
  const runs = await db.query`SELECT COUNT(*) AS Cnt FROM QaTestRuns WHERE Name LIKE '__vitest%'`;
  const bugs = await db.query`SELECT COUNT(*) AS Cnt FROM QaBugs WHERE Title LIKE '__vitest%'`;
  console.log("QaProjects:", projects.recordset[0].Cnt);
  console.log("QaModules:", modules.recordset[0].Cnt);
  console.log("QaTestSuites:", suites.recordset[0].Cnt);
  console.log("QaTestCases:", cases.recordset[0].Cnt);
  console.log("QaTestRuns:", runs.recordset[0].Cnt);
  console.log("QaBugs:", bugs.recordset[0].Cnt);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
