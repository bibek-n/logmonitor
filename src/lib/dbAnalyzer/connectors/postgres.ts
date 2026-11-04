import { Client } from "pg";
import type { ConnectionConfig, SchemaSnapshot, TableInfo, ColumnInfo, IndexInfo, ForeignKeyInfo } from "../types";

async function connect(config: ConnectionConfig): Promise<Client> {
  const client = new Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  return client;
}

export async function testConnection(config: ConnectionConfig): Promise<void> {
  const client = await connect(config);
  try {
    await client.query("SELECT 1");
  } finally {
    await client.end();
  }
}

// Reads structure only (information_schema + pg_catalog for indexes) - never selects actual
// row data.
export async function introspectSchema(config: ConnectionConfig): Promise<SchemaSnapshot> {
  const client = await connect(config);
  try {
    const versionResult = await client.query<{ v: string }>("SELECT version() AS v");
    const serverVersion = versionResult.rows[0]?.v ?? null;

    const columnsResult = await client.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
      character_maximum_length: number | null;
    }>(
      `SELECT table_name, column_name, data_type, is_nullable, character_maximum_length
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`
    );

    const pkResult = await client.query<{ table_name: string; column_name: string }>(
      `SELECT tc.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'`
    );
    const pkSet = new Set(pkResult.rows.map((r) => `${r.table_name}.${r.column_name}`));

    const fkResult = await client.query<{
      table_name: string;
      column_name: string;
      referenced_table: string;
      referenced_column: string;
    }>(
      `SELECT
         tc.table_name, kcu.column_name,
         ccu.table_name AS referenced_table, ccu.column_name AS referenced_column
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`
    );

    const indexResult = await client.query<{
      table_name: string;
      index_name: string;
      column_name: string;
      is_unique: boolean;
    }>(
      `SELECT
         t.relname AS table_name, i.relname AS index_name, a.attname AS column_name, ix.indisunique AS is_unique
       FROM pg_index ix
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
       WHERE n.nspname = 'public'
       ORDER BY t.relname, i.relname`
    );

    const rowCountResult = await client.query<{ relname: string; n_live_tup: number }>(
      `SELECT relname, n_live_tup FROM pg_stat_user_tables`
    );
    const rowCountMap = new Map(rowCountResult.rows.map((r) => [r.relname, r.n_live_tup]));

    const tableMap = new Map<string, TableInfo>();
    for (const row of columnsResult.rows) {
      let table = tableMap.get(row.table_name);
      if (!table) {
        table = { name: row.table_name, schema: "public", rowCountEstimate: rowCountMap.get(row.table_name) ?? null, columns: [], indexes: [], foreignKeys: [] };
        tableMap.set(row.table_name, table);
      }
      const column: ColumnInfo = {
        name: row.column_name,
        dataType: row.data_type,
        nullable: row.is_nullable === "YES",
        isPrimaryKey: pkSet.has(`${row.table_name}.${row.column_name}`),
        isForeignKey: false,
        maxLength: row.character_maximum_length,
      };
      table.columns.push(column);
    }

    for (const row of fkResult.rows) {
      const table = tableMap.get(row.table_name);
      if (!table) continue;
      const fk: ForeignKeyInfo = { columnName: row.column_name, referencedTable: row.referenced_table, referencedColumn: row.referenced_column };
      table.foreignKeys.push(fk);
      const column = table.columns.find((c) => c.name === fk.columnName);
      if (column) column.isForeignKey = true;
    }

    const indexMap = new Map<string, IndexInfo>();
    for (const row of indexResult.rows) {
      const table = tableMap.get(row.table_name);
      if (!table) continue;
      const key = `${row.table_name}.${row.index_name}`;
      let index = indexMap.get(key);
      if (!index) {
        index = { name: row.index_name, columns: [], isUnique: row.is_unique };
        indexMap.set(key, index);
        table.indexes.push(index);
      }
      index.columns.push(row.column_name);
    }

    return { tables: Array.from(tableMap.values()), serverVersion };
  } finally {
    await client.end();
  }
}
