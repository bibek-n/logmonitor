import "dotenv/config";
import fs from "fs";
import { getDb } from "../src/lib/db";

// Schema-only export (tables, columns, defaults, checks, keys, indexes, foreign keys). Reads system catalog views ONLY -
// never touches table data. Usage: tsx scripts/export-schema.ts <output.sql>
type Col = { t: string; name: string; type: string; max_length: number; precision: number; scale: number; is_nullable: boolean; is_identity: boolean; seed: number | null; inc: number | null; def: string | null; defname: string | null; computed: string | null; column_id: number };

function typeSql(c: Col): string {
  const t = c.type.toLowerCase();
  if (["varchar", "char", "varbinary", "binary"].includes(t)) return `${t}(${c.max_length === -1 ? "MAX" : c.max_length})`;
  if (["nvarchar", "nchar"].includes(t)) return `${t}(${c.max_length === -1 ? "MAX" : c.max_length / 2})`;
  if (["decimal", "numeric"].includes(t)) return `${t}(${c.precision},${c.scale})`;
  if (["datetime2", "time", "datetimeoffset"].includes(t)) return `${t}(${c.scale})`;
  return t;
}

async function main() {
  const out = process.argv[2];
  if (!out) {
    console.error("usage: export-schema.ts <output.sql>");
    process.exit(2);
  }
  const db = await getDb();
  const dbName = (await db.query<{ n: string }>("SELECT DB_NAME() AS n")).recordset[0].n;

  const cols = (
    await db.query<Col>(`
    SELECT s.name + '.' + t.name AS t, c.name, ty.name AS type, c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity,
      CAST(ic.seed_value AS BIGINT) AS seed, CAST(ic.increment_value AS BIGINT) AS inc, dc.definition AS def, dc.name AS defname, cc.definition AS computed, c.column_id
    FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
    JOIN sys.columns c ON c.object_id = t.object_id JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    LEFT JOIN sys.identity_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    LEFT JOIN sys.default_constraints dc ON dc.object_id = c.default_object_id
    LEFT JOIN sys.computed_columns cc ON cc.object_id = c.object_id AND cc.column_id = c.column_id
    WHERE t.is_ms_shipped = 0 ORDER BY s.name, t.name, c.column_id`)
  ).recordset;

  const checks = (
    await db.query<{ t: string; name: string; def: string }>(`
    SELECT s.name + '.' + t.name AS t, k.name, k.definition AS def FROM sys.check_constraints k
    JOIN sys.tables t ON t.object_id = k.parent_object_id JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE k.parent_column_id = 0 OR 1 = 1`)
  ).recordset;

  const idx = (
    await db.query<{ t: string; name: string; type_desc: string; is_unique: boolean; is_pk: boolean; is_uc: boolean; filter: string | null; keys: string; incl: string | null }>(`
    SELECT s.name + '.' + t.name AS t, i.name, i.type_desc, i.is_unique, i.is_primary_key AS is_pk, i.is_unique_constraint AS is_uc, i.filter_definition AS filter,
      STUFF((SELECT ', ' + QUOTENAME(c.name) + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE '' END
             FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
             WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0 ORDER BY ic.key_ordinal FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '') AS keys,
      STUFF((SELECT ', ' + QUOTENAME(c.name)
             FROM sys.index_columns ic JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
             WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1 ORDER BY ic.index_column_id FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '') AS incl
    FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE i.type > 0 AND t.is_ms_shipped = 0 AND i.is_hypothetical = 0 ORDER BY s.name, t.name, i.index_id`)
  ).recordset;

  const fks = (
    await db.query<{ t: string; name: string; cols: string; ref: string; refcols: string; del: string; upd: string }>(`
    SELECT ps.name + '.' + pt.name AS t, fk.name,
      STUFF((SELECT ', ' + QUOTENAME(pc.name) FROM sys.foreign_key_columns fkc JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
             WHERE fkc.constraint_object_id = fk.object_id ORDER BY fkc.constraint_column_id FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '') AS cols,
      rs.name + '.' + rt.name AS ref,
      STUFF((SELECT ', ' + QUOTENAME(rc.name) FROM sys.foreign_key_columns fkc JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
             WHERE fkc.constraint_object_id = fk.object_id ORDER BY fkc.constraint_column_id FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '') AS refcols,
      fk.delete_referential_action_desc AS del, fk.update_referential_action_desc AS upd
    FROM sys.foreign_keys fk JOIN sys.tables pt ON pt.object_id = fk.parent_object_id JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
    JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id JOIN sys.schemas rs ON rs.schema_id = rt.schema_id ORDER BY ps.name, pt.name, fk.name`)
  ).recordset;

  const q = (full: string) => full.split(".").map((p) => `[${p}]`).join(".");
  const lines: string[] = [];
  lines.push(`-- Schema-only export of database [${dbName}] - structure only, NO data.`);
  lines.push(`-- Generated ${new Date().toISOString()} from sys.* catalog views.`);
  lines.push("SET NOCOUNT ON;", "GO", "");

  const byTable = new Map<string, Col[]>();
  for (const c of cols) {
    if (!byTable.has(c.t)) byTable.set(c.t, []);
    byTable.get(c.t)!.push(c);
  }
  for (const [t, cs] of byTable) {
    lines.push(`CREATE TABLE ${q(t)} (`);
    const parts = cs.map((c) => {
      if (c.computed) return `  [${c.name}] AS ${c.computed}`;
      let s = `  [${c.name}] ${typeSql(c)}`;
      if (c.is_identity) s += ` IDENTITY(${c.seed ?? 1},${c.inc ?? 1})`;
      s += c.is_nullable ? " NULL" : " NOT NULL";
      if (c.def) s += ` CONSTRAINT [${c.defname}] DEFAULT ${c.def}`;
      return s;
    });
    for (const k of checks.filter((k) => k.t === t)) parts.push(`  CONSTRAINT [${k.name}] CHECK ${k.def}`);
    lines.push(parts.join(",\n"), ");", "GO", "");
  }

  for (const i of idx) {
    if (i.is_pk) lines.push(`ALTER TABLE ${q(i.t)} ADD CONSTRAINT [${i.name}] PRIMARY KEY ${i.type_desc === "CLUSTERED" ? "CLUSTERED" : "NONCLUSTERED"} (${i.keys});`, "GO");
    else if (i.is_uc) lines.push(`ALTER TABLE ${q(i.t)} ADD CONSTRAINT [${i.name}] UNIQUE ${i.type_desc === "CLUSTERED" ? "CLUSTERED" : "NONCLUSTERED"} (${i.keys});`, "GO");
    else if (i.type_desc.includes("COLUMNSTORE")) lines.push(`-- columnstore index [${i.name}] on ${q(i.t)} omitted`, "");
    else {
      let s = `CREATE ${i.is_unique ? "UNIQUE " : ""}${i.type_desc === "CLUSTERED" ? "CLUSTERED" : "NONCLUSTERED"} INDEX [${i.name}] ON ${q(i.t)} (${i.keys})`;
      if (i.incl) s += ` INCLUDE (${i.incl})`;
      if (i.filter) s += ` WHERE ${i.filter}`;
      lines.push(s + ";", "GO");
    }
  }
  lines.push("");
  for (const f of fks) {
    let s = `ALTER TABLE ${q(f.t)} ADD CONSTRAINT [${f.name}] FOREIGN KEY (${f.cols}) REFERENCES ${q(f.ref)} (${f.refcols})`;
    if (f.del !== "NO_ACTION") s += ` ON DELETE ${f.del.replace("_", " ")}`;
    if (f.upd !== "NO_ACTION") s += ` ON UPDATE ${f.upd.replace("_", " ")}`;
    lines.push(s + ";", "GO");
  }

  fs.writeFileSync(out, lines.join("\n") + "\n", "utf8");
  console.log(`tables=${byTable.size} indexes=${idx.length} foreignKeys=${fks.length} checks=${checks.length} -> ${out}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
