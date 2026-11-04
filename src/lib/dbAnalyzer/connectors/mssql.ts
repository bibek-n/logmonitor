import sql from "mssql";
import type { ConnectionConfig, SchemaSnapshot, TableInfo, ColumnInfo, IndexInfo, ForeignKeyInfo } from "../types";

async function connect(config: ConnectionConfig): Promise<sql.ConnectionPool> {
  return new sql.ConnectionPool({
    server: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    options: { trustServerCertificate: true, encrypt: false },
    connectionTimeout: 10000,
    requestTimeout: 20000,
  }).connect();
}

export async function testConnection(config: ConnectionConfig): Promise<void> {
  const pool = await connect(config);
  try {
    await pool.request().query("SELECT 1");
  } finally {
    await pool.close();
  }
}

// Reads structure only (INFORMATION_SCHEMA + sys.indexes) - never selects actual row data,
// so a Database Analyzer connection with read access to a production database can't leak
// its contents even if the stored credentials are broader than intended.
export async function introspectSchema(config: ConnectionConfig): Promise<SchemaSnapshot> {
  const pool = await connect(config);
  try {
    const versionResult = await pool.request().query<{ v: string }>("SELECT @@VERSION AS v");
    const serverVersion = versionResult.recordset[0]?.v?.split("\n")[0] ?? null;

    const columnsResult = await pool.request().query<{
      TableName: string;
      ColumnName: string;
      DataType: string;
      IsNullable: string;
      MaxLength: number | null;
    }>(`
      SELECT TABLE_NAME AS TableName, COLUMN_NAME AS ColumnName, DATA_TYPE AS DataType,
             IS_NULLABLE AS IsNullable, CHARACTER_MAXIMUM_LENGTH AS MaxLength
      FROM INFORMATION_SCHEMA.COLUMNS
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    const pkResult = await pool.request().query<{ TableName: string; ColumnName: string }>(`
      SELECT tc.TABLE_NAME AS TableName, kcu.COLUMN_NAME AS ColumnName
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
    `);
    const pkSet = new Set(pkResult.recordset.map((r) => `${r.TableName}.${r.ColumnName}`));

    const fkResult = await pool.request().query<{
      TableName: string;
      ColumnName: string;
      ReferencedTable: string;
      ReferencedColumn: string;
    }>(`
      SELECT
        fk_tc.TABLE_NAME AS TableName, fk_kcu.COLUMN_NAME AS ColumnName,
        pk_kcu.TABLE_NAME AS ReferencedTable, pk_kcu.COLUMN_NAME AS ReferencedColumn
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
      JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS fk_tc ON fk_tc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE fk_kcu ON fk_kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE pk_kcu ON pk_kcu.CONSTRAINT_NAME = rc.UNIQUE_CONSTRAINT_NAME
    `);

    const indexResult = await pool.request().query<{
      TableName: string;
      IndexName: string;
      ColumnName: string;
      IsUnique: boolean;
    }>(`
      SELECT t.name AS TableName, i.name AS IndexName, c.name AS ColumnName, i.is_unique AS IsUnique
      FROM sys.indexes i
      JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      JOIN sys.tables t ON t.object_id = i.object_id
      WHERE i.name IS NOT NULL
      ORDER BY t.name, i.name, ic.key_ordinal
    `);

    // "RowCount" is a reserved T-SQL keyword (SET ROWCOUNT) - using it unbracketed as a column
    // alias fails with "Incorrect syntax near the keyword 'RowCount'" on every edition/version.
    const rowCountResult = await pool.request().query<{ TableName: string; RowCount: number }>(`
      SELECT t.name AS TableName, SUM(p.rows) AS [RowCount]
      FROM sys.tables t
      JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
      GROUP BY t.name
    `);
    const rowCountMap = new Map(rowCountResult.recordset.map((r) => [r.TableName, r.RowCount]));

    const tableMap = new Map<string, TableInfo>();
    for (const row of columnsResult.recordset) {
      let table = tableMap.get(row.TableName);
      if (!table) {
        table = { name: row.TableName, schema: null, rowCountEstimate: rowCountMap.get(row.TableName) ?? null, columns: [], indexes: [], foreignKeys: [] };
        tableMap.set(row.TableName, table);
      }
      const column: ColumnInfo = {
        name: row.ColumnName,
        dataType: row.DataType,
        nullable: row.IsNullable === "YES",
        isPrimaryKey: pkSet.has(`${row.TableName}.${row.ColumnName}`),
        isForeignKey: false,
        maxLength: row.MaxLength,
      };
      table.columns.push(column);
    }

    for (const row of fkResult.recordset) {
      const table = tableMap.get(row.TableName);
      if (!table) continue;
      const fk: ForeignKeyInfo = { columnName: row.ColumnName, referencedTable: row.ReferencedTable, referencedColumn: row.ReferencedColumn };
      table.foreignKeys.push(fk);
      const column = table.columns.find((c) => c.name === row.ColumnName);
      if (column) column.isForeignKey = true;
    }

    const indexMap = new Map<string, IndexInfo>();
    for (const row of indexResult.recordset) {
      const table = tableMap.get(row.TableName);
      if (!table) continue;
      const key = `${row.TableName}.${row.IndexName}`;
      let index = indexMap.get(key);
      if (!index) {
        index = { name: row.IndexName, columns: [], isUnique: row.IsUnique };
        indexMap.set(key, index);
        table.indexes.push(index);
      }
      index.columns.push(row.ColumnName);
    }

    return { tables: Array.from(tableMap.values()), serverVersion };
  } finally {
    await pool.close();
  }
}
