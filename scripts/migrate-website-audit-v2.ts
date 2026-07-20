import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// Additive-only: every new column is nullable, so existing v1 rows and code paths keep
// working unchanged while new enterprise-report fields (CVSS/CWE/OWASP mapping, confidence,
// affected URL/parameter/method, per-module scoring, masked HTTP request/response evidence)
// become available for the v2 scanning engine to populate going forward.
async function main() {
  const db = await getDb();

  const enterpriseFindingColumns: [string, string][] = [
    ["Cvss", "FLOAT NULL"],
    ["Cwe", "NVARCHAR(20) NULL"],
    ["OwaspCategory", "NVARCHAR(100) NULL"],
    ["Confidence", "NVARCHAR(20) NULL"],
    ["AffectedUrl", "NVARCHAR(500) NULL"],
    ["Parameter", "NVARCHAR(200) NULL"],
    ["HttpMethod", "NVARCHAR(10) NULL"],
    ["Module", "NVARCHAR(50) NULL"],
    ["HttpRequestSnippet", "NVARCHAR(MAX) NULL"],
    ["HttpResponseSnippet", "NVARCHAR(MAX) NULL"],
  ];

  for (const table of ["WebsiteAuditFindings", "WebsiteDependencyFindings", "WebsiteCodeFindings"]) {
    for (const [column, type] of enterpriseFindingColumns) {
      await addColumnIfMissing(db, table, column, type);
    }
  }

  const scanColumns: [string, string][] = [
    ["ScanDurationMs", "INT NULL"],
    ["WebsiteStatus", "NVARCHAR(20) NULL"],
    ["HostingProvider", "NVARCHAR(200) NULL"],
    ["Asn", "NVARCHAR(50) NULL"],
    ["IpAddress", "NVARCHAR(64) NULL"],
    ["Ipv6Address", "NVARCHAR(64) NULL"],
    ["ScoreHeaders", "INT NULL"],
    ["ScoreSsl", "INT NULL"],
    ["ScoreAuth", "INT NULL"],
    ["ScoreCookies", "INT NULL"],
    ["ScoreJs", "INT NULL"],
    ["ScoreDns", "INT NULL"],
    ["ScoreEmail", "INT NULL"],
    ["ScoreServer", "INT NULL"],
    ["ScoreOwasp", "INT NULL"],
    ["ScorePerformance", "INT NULL"],
  ];
  for (const [column, type] of scanColumns) {
    await addColumnIfMissing(db, "WebsiteAuditScans", column, type);
  }

  console.log("Website Security Audit v2 (enterprise fields) columns ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
