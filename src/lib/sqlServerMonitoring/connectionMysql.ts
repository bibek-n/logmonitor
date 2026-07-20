import mysql from "mysql2/promise";
import { decryptSqlPassword } from "./credentials";
import type { InstanceToCollect } from "./shared";

// Cached per InstanceId for the lifetime of the collector process, same rationale as the
// MSSQL remote-pool cache in connection.ts. There is no "self-monitoring" concept for
// MySQL/Postgres instances - this app's own database is always MSSQL, so every MySQL
// instance is a genuinely remote target with its own stored credentials.
const mysqlConnections = new Map<number, mysql.Connection>();

export async function getMysqlConnection(instance: InstanceToCollect): Promise<mysql.Connection> {
  const cached = mysqlConnections.get(instance.Id);
  if (cached) {
    try {
      await cached.query("SELECT 1");
      return cached;
    } catch {
      mysqlConnections.delete(instance.Id);
    }
  }

  if (!instance.SqlUsername || !instance.SqlPasswordEncrypted) {
    throw new Error(`Instance "${instance.HostName}" has no stored MySQL credentials.`);
  }

  const connection = await mysql.createConnection({
    host: instance.HostName,
    port: instance.Port,
    user: instance.SqlUsername,
    password: decryptSqlPassword(instance.SqlPasswordEncrypted),
    connectTimeout: 10000,
  });
  mysqlConnections.set(instance.Id, connection);
  return connection;
}

export async function closeAllMysqlConnections(): Promise<void> {
  for (const connection of mysqlConnections.values()) {
    await connection.end().catch(() => {});
  }
  mysqlConnections.clear();
}
