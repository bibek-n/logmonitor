import "dotenv/config";
import { getDb } from "../src/lib/db";
import { runWordPressDeepScan } from "../src/lib/wordpressScan/runScan";
import { saveWordPressScan } from "../src/lib/wordpressScan/persist";

interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
  PhpVersion: string | null;
}

async function main() {
  const db = await getDb();
  const sites = await db.query<WebsiteRow>(
    `SELECT Id, Name, Url, PhpVersion FROM Websites WHERE Enabled = 1 AND Platform = 'WordPress' ORDER BY Name`
  );
  console.log(`Scanning ${sites.recordset.length} WordPress site(s)...`);

  for (const site of sites.recordset) {
    try {
      const report = await runWordPressDeepScan(site.Url, undefined, site.PhpVersion);
      const scanId = await saveWordPressScan(report, site.Id, { userId: 0, username: "bulk-scan" });
      console.log(
        `${site.Name} -> core=${report.coreVersion ?? "-"} latest=${report.latestCoreVersion ?? "-"} php=${report.phpVersion ?? "-"} corePhpReq=${report.corePhpRequirement ?? "-"} plugins=${report.plugins.length} findings=${report.findings.length} risk=${report.riskLevel} #${scanId}`
      );
    } catch (err) {
      console.log(`${site.Name} -> ERROR: ${err instanceof Error ? err.message : "scan failed"}`);
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
