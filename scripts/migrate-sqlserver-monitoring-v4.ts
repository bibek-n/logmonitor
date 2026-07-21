import "dotenv/config";
import { getDb } from "../src/lib/db";
import type { ConnectionPool } from "mssql";

async function addColumnIfMissing(db: ConnectionPool, table: string, column: string, type: string) {
  await db.query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${type}
  `);
}

// New "Top 10 Queries by Disk Reads/Writes" ranking, sitting alongside the existing
// duration/cpu/memory rankings on SqlServerSlowQueries. Unlike MaxUsedGrantKB (SQL Server
// 2016 SP1+ only), sys.dm_exec_query_stats.total_logical_reads/total_logical_writes have
// existed since SQL Server 2005, so this works even on the older instances that can't show
// a memory-grant ranking.
async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "SqlServerSlowQueries", "AvgLogicalReads", "FLOAT NULL");
  await addColumnIfMissing(db, "SqlServerSlowQueries", "AvgLogicalWrites", "FLOAT NULL");

  await db.query(`
    IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_SqlServerSlowQueries_RankBy')
    ALTER TABLE SqlServerSlowQueries DROP CONSTRAINT CK_SqlServerSlowQueries_RankBy
  `);
  await db.query(`
    ALTER TABLE SqlServerSlowQueries ADD CONSTRAINT CK_SqlServerSlowQueries_RankBy CHECK (RankBy IN ('duration','cpu','memory','reads'))
  `);

  console.log("SQL Server Monitoring v4 schema ready (top queries by disk reads/writes).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
