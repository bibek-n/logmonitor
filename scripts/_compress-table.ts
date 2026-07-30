import "dotenv/config";
import sql from "mssql";

const tableArg = process.argv[2];
if (!tableArg) {
  console.error("Usage: tsx _compress-table.ts <TableName>");
  process.exit(1);
}

async function main() {
  const pool = await new sql.ConnectionPool({
    server: process.env.DB_SERVER!,
    database: process.env.DB_DATABASE!,
    options: { trustServerCertificate: true, encrypt: false },
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    requestTimeout: 30 * 60 * 1000,
  }).connect();

  const beforeResult = await pool.query(`
    SELECT CAST(ROUND(SUM(a.total_pages) * 8 / 1024.00, 2) AS NUMERIC(36, 2)) AS TotalSpaceMB
    FROM sys.tables t
    JOIN sys.indexes i ON t.OBJECT_ID = i.object_id
    JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
    JOIN sys.allocation_units a ON p.partition_id = a.container_id
    WHERE t.name = '${tableArg}'
  `);
  console.log(`Before: ${beforeResult.recordset[0].TotalSpaceMB} MB`);

  const indexesResult = await pool.query(`
    SELECT i.index_id AS IndexId, i.name AS IndexName, i.type_desc AS TypeDesc
    FROM sys.indexes i
    WHERE i.object_id = OBJECT_ID('${tableArg}') AND i.type_desc IN ('HEAP', 'CLUSTERED', 'NONCLUSTERED')
    ORDER BY i.index_id
  `);

  for (const idx of indexesResult.recordset) {
    const start = Date.now();
    if (idx.IndexId === 0) {
      console.log(`Compressing heap (base table) ${tableArg}...`);
      await pool.query(`ALTER TABLE [${tableArg}] REBUILD WITH (DATA_COMPRESSION = PAGE)`);
    } else {
      console.log(`Compressing index ${idx.IndexName} (${idx.TypeDesc}) on ${tableArg}...`);
      await pool.query(`ALTER INDEX [${idx.IndexName}] ON [${tableArg}] REBUILD WITH (DATA_COMPRESSION = PAGE, ONLINE = ON)`);
    }
    console.log(`  done in ${((Date.now() - start) / 1000).toFixed(0)}s`);
  }

  const afterResult = await pool.query(`
    SELECT CAST(ROUND(SUM(a.total_pages) * 8 / 1024.00, 2) AS NUMERIC(36, 2)) AS TotalSpaceMB
    FROM sys.tables t
    JOIN sys.indexes i ON t.OBJECT_ID = i.object_id
    JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
    JOIN sys.allocation_units a ON p.partition_id = a.container_id
    WHERE t.name = '${tableArg}'
  `);
  console.log(`After: ${afterResult.recordset[0].TotalSpaceMB} MB`);

  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
