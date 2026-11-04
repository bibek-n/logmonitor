import mysql from "mysql2/promise";
import type { ConnectionConfig, SchemaSnapshot, TableInfo, ColumnInfo, IndexInfo, ForeignKeyInfo } from "../types";

async function connect(config: ConnectionConfig): Promise<mysql.Connection> {
  return mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    connectTimeout: 10000,
  });
}

export async function testConnection(config: ConnectionConfig): Promise<void> {
  const conn = await connect(config);
  try {
    await conn.query("SELECT 1");
  } finally {
    await conn.end();
  }
}

// Reads structure only (information_schema) - never selects actual row data.
export async function introspectSchema(config: ConnectionConfig): Promise<SchemaSnapshot> {
  const conn = await connect(config);
  try {
    const [versionRows] = await conn.query<mysql.RowDataPacket[]>("SELECT VERSION() AS v");
    const serverVersion = (versionRows[0]?.v as string | undefined) ?? null;

    const [columnRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME AS TableName, COLUMN_NAME AS ColumnName, DATA_TYPE AS DataType,
              IS_NULLABLE AS IsNullable, CHARACTER_MAXIMUM_LENGTH AS MaxLength, COLUMN_KEY AS ColumnKey
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [config.database]
    );

    const [fkRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME AS TableName, COLUMN_NAME AS ColumnName, REFERENCED_TABLE_NAME AS ReferencedTable, REFERENCED_COLUMN_NAME AS ReferencedColumn
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [config.database]
    );

    const [indexRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME AS TableName, INDEX_NAME AS IndexName, COLUMN_NAME AS ColumnName, NON_UNIQUE AS NonUnique
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
      [config.database]
    );

    const [rowCountRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME AS TableName, TABLE_ROWS AS RowCount
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?`,
      [config.database]
    );
    const rowCountMap = new Map(rowCountRows.map((r) => [r.TableName as string, r.RowCount as number | null]));

    const tableMap = new Map<string, TableInfo>();
    for (const row of columnRows) {
      const tableName = row.TableName as string;
      let table = tableMap.get(tableName);
      if (!table) {
        table = { name: tableName, schema: config.database, rowCountEstimate: rowCountMap.get(tableName) ?? null, columns: [], indexes: [], foreignKeys: [] };
        tableMap.set(tableName, table);
      }
      const column: ColumnInfo = {
        name: row.ColumnName as string,
        dataType: row.DataType as string,
        nullable: row.IsNullable === "YES",
        isPrimaryKey: row.ColumnKey === "PRI",
        isForeignKey: false,
        maxLength: (row.MaxLength as number | null) ?? null,
      };
      table.columns.push(column);
    }

    for (const row of fkRows) {
      const table = tableMap.get(row.TableName as string);
      if (!table) continue;
      const fk: ForeignKeyInfo = {
        columnName: row.ColumnName as string,
        referencedTable: row.ReferencedTable as string,
        referencedColumn: row.ReferencedColumn as string,
      };
      table.foreignKeys.push(fk);
      const column = table.columns.find((c) => c.name === fk.columnName);
      if (column) column.isForeignKey = true;
    }

    const indexMap = new Map<string, IndexInfo>();
    for (const row of indexRows) {
      const tableName = row.TableName as string;
      const table = tableMap.get(tableName);
      if (!table) continue;
      const indexName = row.IndexName as string;
      const key = `${tableName}.${indexName}`;
      let index = indexMap.get(key);
      if (!index) {
        index = { name: indexName, columns: [], isUnique: Number(row.NonUnique) === 0 };
        indexMap.set(key, index);
        table.indexes.push(index);
      }
      index.columns.push(row.ColumnName as string);
    }

    return { tables: Array.from(tableMap.values()), serverVersion };
  } finally {
    await conn.end();
  }
}
