import { getDb, sql } from "@/lib/db";
import type { ConnectionPool, config as SqlConfig } from "mssql";
import { decryptSqlPassword } from "./credentials";
import type { InstanceToCollect as InstanceConfig } from "./shared";

// Remote-instance pools are cached per InstanceId for the lifetime of this process (the
// collector CLI runs one pass and exits, so in practice this cache just avoids reconnecting
// between the several DMV queries within a single pass) - never for the self-monitoring
// instance, which always reuses the app's own shared pool via getDb().
const remotePools = new Map<number, ConnectionPool>();

// Returns a live connection for the given instance - the app's own shared pool for the
// self-monitoring row (no separate credentials needed, always available), or a
// lazily-created, cached pool built from the instance's stored (encrypted-at-rest)
// credentials for any other registered instance.
export async function getInstanceConnection(instance: InstanceConfig): Promise<ConnectionPool> {
  if (instance.IsSelfMonitoring) {
    return getDb();
  }

  const cached = remotePools.get(instance.Id);
  if (cached && cached.connected) return cached;

  if (!instance.SqlUsername || !instance.SqlPasswordEncrypted) {
    throw new Error(`Instance "${instance.HostName}" has no stored SQL credentials.`);
  }

  const config: SqlConfig = {
    server: instance.HostName,
    port: instance.Port,
    database: "master",
    options: { trustServerCertificate: true, encrypt: false },
    user: instance.SqlUsername,
    password: decryptSqlPassword(instance.SqlPasswordEncrypted),
    connectionTimeout: 10000,
    requestTimeout: 15000,
  };

  const pool = await new sql.ConnectionPool(config).connect();
  remotePools.set(instance.Id, pool);
  return pool;
}

export async function closeAllRemotePools(): Promise<void> {
  for (const pool of remotePools.values()) {
    await pool.close().catch(() => {});
  }
  remotePools.clear();
}
