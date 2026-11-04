export type DbEngine = "mssql" | "mysql" | "postgres";

export const DB_ENGINE_LABELS: Record<DbEngine, string> = {
  mssql: "SQL Server",
  mysql: "MySQL",
  postgres: "PostgreSQL",
};

// "live" = connects over the network with stored credentials (Phase 1). "upload" = a .sql
// DDL script (schema-only dump / CREATE TABLE script) pasted through the rule engine with no
// live connection at all - same downstream rules, just a different source for SchemaSnapshot.
export type ConnectionSource = "live" | "upload";

// Non-AI = rule engine only (Phase 1 behavior, the default and the only mode that works with
// no AI config at all). AI = schema reviewed by the model instead of the rule engine. Hybrid =
// both run, findings merged (each tagged via Finding.source), plus a plain-language summary.
export type AnalysisMode = "non_ai" | "ai" | "hybrid";

export interface ConnectionConfig {
  engine: DbEngine;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  maxLength: number | null;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
}

export interface ForeignKeyInfo {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface TableInfo {
  name: string;
  schema: string | null;
  rowCountEstimate: number | null;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  foreignKeys: ForeignKeyInfo[];
}

export interface SchemaSnapshot {
  tables: TableInfo[];
  serverVersion: string | null;
}

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type RiskLevel = "Critical" | "High" | "Medium" | "Low";

export type FindingCategory = "structure" | "security" | "sensitive-data";

export interface Finding {
  id?: number;
  category: FindingCategory;
  severity: Severity;
  title: string;
  detail?: string;
  evidence?: string;
  affectedObject?: string;
  recommendation?: string;
  // "rule" (deterministic rule engine) or "ai" (model-generated, Hybrid/AI mode only).
  // Undefined on any finding written before this field existed - treated as "rule".
  source?: "rule" | "ai";
}

export interface ScanSummary {
  scanId: number;
  tableCount: number;
  findingCount: number;
  securityScore: number;
  riskLevel: RiskLevel;
}
