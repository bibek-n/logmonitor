import { Client } from "pg";
import { decryptSqlPassword } from "./credentials";
import type { InstanceToCollect } from "./shared";

// Same caching rationale as connectionMysql.ts. Connects to the "postgres" maintenance
// database by default - cross-database metrics (size, sessions, locks) are read via
// catalog/DMV-equivalent views that see every database on the cluster from there, matching
// how the MSSQL collector connects to "master" and reads sys.databases for a cluster-wide view.
const postgresClients = new Map<number, Client>();

export async function getPostgresConnection(instance: InstanceToCollect): Promise<Client> {
  const cached = postgresClients.get(instance.Id);
  if (cached) {
    try {
      await cached.query("SELECT 1");
      return cached;
    } catch {
      postgresClients.delete(instance.Id);
    }
  }

  if (!instance.SqlUsername || !instance.SqlPasswordEncrypted) {
    throw new Error(`Instance "${instance.HostName}" has no stored PostgreSQL credentials.`);
  }

  const client = new Client({
    host: instance.HostName,
    port: instance.Port,
    user: instance.SqlUsername,
    password: decryptSqlPassword(instance.SqlPasswordEncrypted),
    database: "postgres",
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  postgresClients.set(instance.Id, client);
  return client;
}

export async function closeAllPostgresConnections(): Promise<void> {
  for (const client of postgresClients.values()) {
    await client.end().catch(() => {});
  }
  postgresClients.clear();
}
