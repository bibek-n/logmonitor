import type { ColumnInfo, DbEngine, ForeignKeyInfo, IndexInfo, SchemaSnapshot, TableInfo } from "./types";

// Best-effort CREATE TABLE / CREATE INDEX parser for an uploaded .sql schema dump (SSMS
// "Script Table as CREATE", mysqldump --no-data, pg_dump --schema-only). This is deliberately
// NOT a full SQL parser - it only needs to recover the same ColumnInfo/IndexInfo/
// ForeignKeyInfo shape introspectSchema() produces from a live connection, since every rule in
// rules/*.ts only ever reads that shape. Anything it can't confidently parse is just skipped
// rather than thrown, so a partially-recognized file still yields partial, useful findings.

function stripComments(sqlText: string): string {
  return sqlText
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

function stripIdentifierQuotes(ident: string): string {
  const trimmed = ident.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed.slice(1, -1);
  if (trimmed.startsWith("`") && trimmed.endsWith("`")) return trimmed.slice(1, -1);
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  return trimmed;
}

// A REFERENCES target can be schema-qualified ("[dbo].[Customers]", "public.orgs") - stripping
// quotes from the whole dotted string (rather than splitting first) mangles it into garbage
// like "dbo].[Customers". Split on "." first, then strip quotes from just the table part.
function lastIdentifierPart(raw: string): string {
  const parts = raw.split(".");
  return stripIdentifierQuotes(parts[parts.length - 1]);
}

// Splits on top-level commas only - a comma inside VARCHAR(255), DECIMAL(10,2), or a nested
// CHECK(...) must not split the clause it's part of.
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

// Finds the span of the parenthesized block starting at `fromIndex` (the first "(" at or
// after it), returning the content between the matching pair, and the index just past the
// closing ")". Returns null if no balanced block is found.
function extractParenBlock(text: string, fromIndex: number): { content: string; endIndex: number } | null {
  const start = text.indexOf("(", fromIndex);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "(") depth++;
    if (text[i] === ")") {
      depth--;
      if (depth === 0) return { content: text.slice(start + 1, i), endIndex: i + 1 };
    }
  }
  return null;
}

const TYPE_STOP_WORDS = new Set([
  "not", "null", "default", "primary", "unique", "references", "check", "constraint",
  "collate", "auto_increment", "identity", "generated", "comment",
]);

// Postgres composite type names ("character varying(255)", "double precision", "timestamp
// without time zone") - each of these words, once a type keyword has already been seen, is
// still part of the type, not a constraint. Matched by the bare word, ignoring any "(n)" the
// word itself might carry (e.g. "varying(255)").
const TYPE_CONTINUATION_WORDS = new Set(["varying", "precision", "without", "with", "time", "zone"]);

function unwrapTypeToken(tok: string): string {
  if (tok.startsWith("[") && tok.endsWith("]")) return tok.slice(1, -1);
  if (tok.startsWith("`") && tok.endsWith("`")) return tok.slice(1, -1);
  if (tok.startsWith('"') && tok.endsWith('"')) return tok.slice(1, -1);
  return tok;
}

function parseColumnClause(clause: string): ColumnInfo | null {
  const trimmed = clause.trim();
  if (!trimmed) return null;

  const tokens = trimmed.match(/\[[^\]]*\]|`[^`]*`|"[^"]*"|'[^']*'|\(.*\)|[^\s,]+/g);
  if (!tokens || tokens.length < 2) return null;

  const name = stripIdentifierQuotes(tokens[0]);
  if (!name) return null;

  const typeTokens: string[] = [];
  let i = 1;
  // Data type: the type keyword itself, plus an optional immediately-following "(n)" or
  // "(n,m)" precision/length group, e.g. "VARCHAR" "(255)" or "DECIMAL" "(10,2)", plus any
  // Postgres-style continuation words after it.
  if (tokens[i] && !TYPE_STOP_WORDS.has(tokens[i].toLowerCase())) {
    typeTokens.push(unwrapTypeToken(tokens[i]));
    i++;
    if (tokens[i] && /^\([^)]*\)$/.test(tokens[i])) {
      typeTokens.push(tokens[i]);
      i++;
    }
    while (tokens[i]) {
      const core = tokens[i].replace(/\(.*\)$/, "").toLowerCase();
      if (!TYPE_CONTINUATION_WORDS.has(core)) break;
      typeTokens.push(unwrapTypeToken(tokens[i]));
      i++;
    }
  }
  let dataType = typeTokens[0] ?? "";
  for (let k = 1; k < typeTokens.length; k++) {
    dataType += typeTokens[k].startsWith("(") ? typeTokens[k] : ` ${typeTokens[k]}`;
  }
  dataType = dataType.toUpperCase();
  if (!dataType) return null;

  const rest = tokens.slice(i).join(" ").toUpperCase();
  const notNull = /NOT\s+NULL/.test(rest);
  const isPrimaryKey = /PRIMARY\s+KEY/.test(rest);
  const lengthMatch = dataType.match(/\((\d+)/);
  const maxLength = lengthMatch ? Number(lengthMatch[1]) : null;

  let isForeignKey = false;
  let referencedTable: string | null = null;
  let referencedColumn: string | null = null;
  const refMatch = clause.match(/REFERENCES\s+([^\s(]+)\s*\(\s*([^\s)]+)\s*\)/i);
  if (refMatch) {
    isForeignKey = true;
    referencedTable = lastIdentifierPart(refMatch[1]);
    referencedColumn = stripIdentifierQuotes(refMatch[2]);
  }

  return {
    name,
    dataType: dataType.replace(/\(MAX\)/i, "(MAX)"),
    nullable: !notNull && !isPrimaryKey,
    isPrimaryKey,
    isForeignKey,
    maxLength,
    // Carried only for the table-level pass below to build ForeignKeyInfo from an inline
    // REFERENCES clause - not part of the public ColumnInfo shape.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...({ __referencedTable: referencedTable, __referencedColumn: referencedColumn } as any),
  };
}

function parseTableLevelConstraint(clause: string): { pkColumns?: string[]; fk?: ForeignKeyInfo; index?: IndexInfo } | null {
  const upper = clause.toUpperCase();

  const pkMatch = clause.match(/PRIMARY\s+KEY\s*\(([^)]*)\)/i);
  if (pkMatch) {
    return { pkColumns: splitTopLevel(pkMatch[1]).map((c) => stripIdentifierQuotes(c)) };
  }

  const fkMatch = clause.match(/FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s+([^\s(]+)\s*\(\s*([^\s)]+)\s*\)/i);
  if (fkMatch) {
    const columns = splitTopLevel(fkMatch[1]).map((c) => stripIdentifierQuotes(c));
    return {
      fk: {
        columnName: columns[0] ?? "",
        referencedTable: lastIdentifierPart(fkMatch[2]),
        referencedColumn: stripIdentifierQuotes(fkMatch[3]),
      },
    };
  }

  if (/^(UNIQUE|KEY|INDEX)\b/.test(upper) || /UNIQUE\s+(KEY|INDEX)/.test(upper)) {
    const colMatch = clause.match(/\(([^)]*)\)/);
    if (colMatch) {
      const nameMatch = clause.match(/(?:KEY|INDEX)\s+([^\s(]+)/i);
      return {
        index: {
          name: nameMatch ? stripIdentifierQuotes(nameMatch[1]) : "unnamed_index",
          columns: splitTopLevel(colMatch[1]).map((c) => stripIdentifierQuotes(c)),
          isUnique: /UNIQUE/.test(upper),
        },
      };
    }
  }

  return null;
}

function parseCreateTableStatements(sqlText: string): TableInfo[] {
  const tables: TableInfo[] = [];
  const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:\[[^\]]*\]|`[^`]*`|"[^"]*"|[\w.]+)(?:\.(?:\[[^\]]*\]|`[^`]*`|"[^"]*"|\w+))?)/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(sqlText)) !== null) {
    const rawName = match[1];
    const nameParts = rawName.split(".");
    const tableName = stripIdentifierQuotes(nameParts[nameParts.length - 1]);
    const schemaName = nameParts.length > 1 ? stripIdentifierQuotes(nameParts[0]) : null;

    const block = extractParenBlock(sqlText, regex.lastIndex);
    if (!block) continue;
    regex.lastIndex = block.endIndex;

    const columns: ColumnInfo[] = [];
    const foreignKeys: ForeignKeyInfo[] = [];
    const indexes: IndexInfo[] = [];
    const pkColumnNames = new Set<string>();

    for (const clause of splitTopLevel(block.content)) {
      const trimmedClause = clause.trim();
      if (!trimmedClause) continue;
      const upperClause = trimmedClause.toUpperCase();
      const isTableLevel =
        /^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|KEY|INDEX|CONSTRAINT|CHECK)\b/.test(upperClause);

      if (isTableLevel) {
        // CONSTRAINT <name> PRIMARY KEY/FOREIGN KEY(...) - strip the leading "CONSTRAINT name"
        // so the same matchers above apply uniformly.
        const stripped = trimmedClause.replace(/^CONSTRAINT\s+(\[[^\]]*\]|`[^`]*`|"[^"]*"|\w+)\s*/i, "");
        const parsed = parseTableLevelConstraint(stripped);
        if (parsed?.pkColumns) parsed.pkColumns.forEach((c) => pkColumnNames.add(c.toLowerCase()));
        if (parsed?.fk) foreignKeys.push(parsed.fk);
        if (parsed?.index) indexes.push(parsed.index);
        continue;
      }

      const column = parseColumnClause(trimmedClause);
      if (column) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const extra = column as any;
        if (extra.__referencedTable) {
          foreignKeys.push({
            columnName: column.name,
            referencedTable: extra.__referencedTable,
            referencedColumn: extra.__referencedColumn,
          });
        }
        delete extra.__referencedTable;
        delete extra.__referencedColumn;
        columns.push(column);
      }
    }

    for (const col of columns) {
      if (pkColumnNames.has(col.name.toLowerCase())) col.isPrimaryKey = true;
    }
    for (const fk of foreignKeys) {
      const col = columns.find((c) => c.name.toLowerCase() === fk.columnName.toLowerCase());
      if (col) col.isForeignKey = true;
    }

    tables.push({ name: tableName, schema: schemaName, rowCountEstimate: null, columns, indexes, foreignKeys });
  }

  return tables;
}

// Standalone CREATE [UNIQUE] INDEX statements (common in Postgres/MySQL dumps, issued
// separately from CREATE TABLE) - attached to the matching table by name if found.
function applyStandaloneIndexes(sqlText: string, tables: TableInfo[]): void {
  const regex = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\[[^\]]*\]|`[^`]*`|"[^"]*"|\w+)\s+ON\s+((?:\[[^\]]*\]|`[^`]*`|"[^"]*"|[\w.]+))\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sqlText)) !== null) {
    const isUnique = !!match[1];
    const indexName = stripIdentifierQuotes(match[2]);
    const tableNameParts = match[3].split(".");
    const tableName = stripIdentifierQuotes(tableNameParts[tableNameParts.length - 1]);
    const columns = splitTopLevel(match[4]).map((c) => stripIdentifierQuotes(c));

    const table = tables.find((t) => t.name.toLowerCase() === tableName.toLowerCase());
    if (table) table.indexes.push({ name: indexName, columns, isUnique });
  }
}

export function parseDdlToSchema(sqlText: string, _engine: DbEngine): SchemaSnapshot {
  const cleaned = stripComments(sqlText);
  const tables = parseCreateTableStatements(cleaned);
  applyStandaloneIndexes(cleaned, tables);
  return { tables, serverVersion: null };
}
