export interface SqlServerInstanceRow {
  Id: number;
  Name: string;
  HostName: string;
  Port: number;
  AuthType: "sql" | "windows";
  SqlUsername: string | null;
  IsSelfMonitoring: boolean;
  Enabled: boolean;
  LastCheckAt: string | null;
  LastCheckStatus: string | null;
  LastErrorMessage: string | null;
}

export interface SqlServerMetricsRow {
  IsAvailable: boolean;
  CpuPct: number | null;
  MemoryUsedMB: number | null;
  MemoryTargetMB: number | null;
  BufferCacheHitRatio: number | null;
  PageLifeExpectancy: number | null;
  ActiveSessionCount: number | null;
  BlockingSessionCount: number | null;
  DeadlockCountCumulative: number | null;
  ReceivedAt: string;
}

export interface SqlServerDatabaseRow {
  DatabaseName: string;
  StateDesc: string;
  RecoveryModel: string | null;
  DataSizeMB: number | null;
  LogSizeMB: number | null;
  LogUsedPercent: number | null;
  LastBackupAt: string | null;
  LastBackupType: string | null;
}

export type DbEngine = "mssql" | "mysql" | "postgres";
export type QueryRank = "duration" | "cpu" | "memory";

// The row shape the dispatcher (collector.ts) reads from SqlServerInstances and hands to
// whichever engine-specific runner handles this instance's Engine value.
export interface InstanceToCollect {
  Id: number;
  Name: string;
  HostName: string;
  Port: number;
  AuthType: string;
  SqlUsername: string | null;
  SqlPasswordEncrypted: string | null;
  IsSelfMonitoring: boolean;
  Engine: DbEngine;
  LastCheckStatus: string | null;
  LastDownAlertAt: string | null;
  // Optional SSH-based backup-status check (currently MySQL/AutoMySQLBackup only - see
  // backupStatusSsh.ts) for engines with no built-in backup catalog. Null/unset means this
  // instance has no SSH backup check configured, not that it failed.
  SshHost: string | null;
  SshPort: number | null;
  SshUsername: string | null;
  SshPasswordEncrypted: string | null;
  BackupBaseDir: string | null;
}

export interface InstanceCollectionResult {
  instanceName: string;
  status: "Healthy" | "Failed";
  message: string;
}

// Everything an engine collector can report about a single instance's "live health" scalars -
// engines that don't expose a concept (e.g. Page Life Expectancy on MySQL/Postgres) just leave
// it null, matching the existing per-collector best-effort/graceful-degradation pattern.
export interface CollectedMetrics {
  cpuPct: number | null;
  memoryUsedMB: number | null;
  memoryTargetMB: number | null;
  bufferCacheHitRatio: number | null;
  pageLifeExpectancy: number | null;
  activeSessionCount: number;
  blockingSessionCount: number;
  deadlockCountCumulative: number | null;
}

export interface CollectedDatabase {
  databaseName: string;
  stateDesc: string;
  recoveryModel: string | null;
  dataSizeMB: number | null;
  logSizeMB: number | null;
  logUsedPercent: number | null;
  lastBackupAt: string | Date | null;
  lastBackupType: string | null;
}

export interface CollectedSession {
  sessionId: string;
  loginName: string | null;
  hostName: string | null;
  programName: string | null;
  databaseName: string | null;
  statusText: string | null;
  cpuTimeMs: number | null;
  memoryUsageKB: number | null;
  lastRequestStartTime: string | Date | null;
}

export interface CollectedDeadlock {
  detectedAt: string | Date;
  summary: string;
  xml: string | null;
}

export interface CollectedBlocking {
  blockedSessionId: string;
  blockingSessionId: string;
  waitTimeMs: number | null;
  waitType: string | null;
  databaseName: string | null;
  queryText: string | null;
}

// One row in a top-10-by-X query ranking. avgDurationMs is always populated when available
// (useful context regardless of which metric the list is ranked by); avgCpuTimeMs/
// maxUsedGrantKB are populated only when that specific ranking is being produced.
export interface CollectedQuery {
  databaseName: string | null;
  queryText: string | null;
  avgDurationMs: number | null;
  avgCpuTimeMs: number | null;
  maxUsedGrantKB: number | null;
  executionCount: number;
  lastExecutedAt: string | Date | null;
}
