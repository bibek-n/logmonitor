import "dotenv/config";
import { getDb } from "../src/lib/db";
import { runWordPressDeepScan } from "../src/lib/wordpressScan/runScan";
import { saveWordPressScan } from "../src/lib/wordpressScan/persist";
import { getLatestWordPressRelease } from "../src/lib/wordpressScan/wpOrgApi";

interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
  PhpVersion: string | null;
}

async function main() {
  const latest = await getLatestWordPressRelease();
  console.log(`WordPress.org latest release: ${latest.latestVersion} (recommends PHP ${latest.requiredPhpVersion}+)`);

  const db = await getDb();
  const sites = await db.query<WebsiteRow>(
    `SELECT TOP 3 Id, Name, Url, PhpVersion FROM Websites WHERE Enabled = 1 AND Platform = 'WordPress' ORDER BY Name`
  );
  console.log(`Found ${sites.recordset.length} WordPress site(s) to test (limited to 3 for this smoke test).`);

  for (const site of sites.recordset) {
    console.log(`\n--- ${site.Name} (${site.Url}) ---`);
    const report = await runWordPressDeepScan(site.Url, undefined, site.PhpVersion);
    const scanId = await saveWordPressScan(report, site.Id, { userId: 0, username: "smoke-test" });
    console.log(
      `isWordPress=${report.isWordPress} core=${report.coreVersion} latest=${report.latestCoreVersion} php=${report.phpVersion} corePhpReq=${report.corePhpRequirement} plugins=${report.plugins.length} findings=${report.findings.length} risk=${report.riskLevel} savedAs=#${scanId}`
    );
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
