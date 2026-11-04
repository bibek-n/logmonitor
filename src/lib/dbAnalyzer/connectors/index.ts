import type { ConnectionConfig, SchemaSnapshot } from "../types";
import * as mssqlConnector from "./mssql";
import * as mysqlConnector from "./mysql";
import * as postgresConnector from "./postgres";

export async function testConnection(config: ConnectionConfig): Promise<void> {
  switch (config.engine) {
    case "mssql":
      return mssqlConnector.testConnection(config);
    case "mysql":
      return mysqlConnector.testConnection(config);
    case "postgres":
      return postgresConnector.testConnection(config);
  }
}

export async function introspectSchema(config: ConnectionConfig): Promise<SchemaSnapshot> {
  switch (config.engine) {
    case "mssql":
      return mssqlConnector.introspectSchema(config);
    case "mysql":
      return mysqlConnector.introspectSchema(config);
    case "postgres":
      return postgresConnector.introspectSchema(config);
  }
}
