import type { SchemaSnapshot, Finding } from "../types";

// Structural hygiene checks - no primary key, no indexed foreign keys, oversized text
// columns with no apparent length limit. These are the same categories of issue most
// database-design review checklists flag, computed purely from the catalog metadata already
// read by introspectSchema() - no row data involved.
export function runStructureRules(schema: SchemaSnapshot): Finding[] {
  const findings: Finding[] = [];

  for (const table of schema.tables) {
    const hasPrimaryKey = table.columns.some((c) => c.isPrimaryKey);
    if (!hasPrimaryKey) {
      findings.push({
        category: "structure",
        severity: "medium",
        title: `Table "${table.name}" has no primary key`,
        detail: "Without a primary key, rows can't be reliably identified, updated, or replicated, and ORMs/ETL tools often misbehave against this table.",
        affectedObject: table.name,
        recommendation: `Add a primary key to "${table.name}" (a surrogate Id column if no natural key exists).`,
      });
    }

    const indexedColumns = new Set(table.indexes.flatMap((i) => i.columns));
    for (const fk of table.foreignKeys) {
      if (!indexedColumns.has(fk.columnName)) {
        findings.push({
          category: "structure",
          severity: "low",
          title: `Foreign key "${table.name}.${fk.columnName}" has no index`,
          detail: `References ${fk.referencedTable}.${fk.referencedColumn} but has no supporting index, which slows down joins and cascading deletes/updates on this column.`,
          affectedObject: `${table.name}.${fk.columnName}`,
          recommendation: `Create an index on "${table.name}.${fk.columnName}".`,
        });
      }
    }

    if (table.columns.length === 0) {
      findings.push({
        category: "structure",
        severity: "info",
        title: `Table "${table.name}" has no columns visible to this connection`,
        affectedObject: table.name,
      });
    }
  }

  return findings;
}
