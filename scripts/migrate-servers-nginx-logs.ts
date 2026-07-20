import "dotenv/config";
import { getDb } from "../src/lib/db";

// Adds nginx log support to the Servers module's log pipeline (see migrate-servers.ts's
// original ServerLogEntries table). Unlike apache_access/apache_error (one fixed path per
// source, see agent/logs.go's candidateLogPaths()), nginx installs commonly log EVERY virtual
// host to its own file (confirmed live: /var/log/nginx/<vhost>.access.log /
// <vhost>.error.log, one pair per site-enabled config) - so LogSource stays the same small
// fixed enum ('nginx_access'/'nginx_error'), and SiteName carries which vhost a given entry
// came from (NULL for the default/non-vhost-specific log, and for every non-nginx source).
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ServerLogEntries') AND name = 'SiteName')
    ALTER TABLE ServerLogEntries ADD SiteName NVARCHAR(200) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_ServerLogEntries_SiteName')
    CREATE INDEX IX_ServerLogEntries_SiteName ON ServerLogEntries (SiteName) WHERE SiteName IS NOT NULL
  `;

  console.log("Servers nginx log support ready (ServerLogEntries.SiteName added).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
