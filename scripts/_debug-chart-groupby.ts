import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

async function main() {
  const db = await getDb();
  const allIps = ["192.168.1.98"]; // Sabina

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ipList = allIps.map((_, i) => `@ip${i}`).join(", ");

  const wfCategoryRequest = db.request();
  allIps.forEach((ip, i) => wfCategoryRequest.input(`ip${i}`, sql.VarChar, ip));

  const categoryResult = await wfCategoryRequest.input("since", sql.DateTime2, since).query(`
    SELECT COALESCE(NULLIF(Category, ''), 'Uncategorized') AS Category, COUNT(*) AS Cnt
    FROM WebFilterLogs WHERE SrcIp IN (${ipList}) AND ReceivedAt >= @since
    GROUP BY COALESCE(NULLIF(Category, ''), 'Uncategorized')
  `);
  console.log("Category breakdown:", JSON.stringify(categoryResult.recordset, null, 1));

  const wfApplicationRequest = db.request();
  allIps.forEach((ip, i) => wfApplicationRequest.input(`ip${i}`, sql.VarChar, ip));
  const applicationResult = await wfApplicationRequest.input("since", sql.DateTime2, since).query(`
    SELECT COALESCE(NULLIF(Application, ''), 'Unclassified') AS Application, COUNT(*) AS Cnt
    FROM WebFilterLogs WHERE SrcIp IN (${ipList}) AND ReceivedAt >= @since
    GROUP BY COALESCE(NULLIF(Application, ''), 'Unclassified')
  `);
  console.log("Application breakdown:", JSON.stringify(applicationResult.recordset, null, 1));

  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
