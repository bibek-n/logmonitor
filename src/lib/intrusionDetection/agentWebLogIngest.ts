import { getDb, sql } from "@/lib/db";
import type { LogSourceRow } from "./store";

// Resolves the SecurityLogSources row an endpoint agent's forwarded web-log events belong to,
// auto-creating both it and its parent SecurityProtectedApplications entry (AppType='Server')
// on first contact from a given device+site. This is what makes rollout to a new server a
// zero-admin-action affair - registering 89 protected apps by hand (see the module's own
// dashboard copy) isn't realistic, but "the first batch from this device+site creates its own
// row" scales to any number of servers automatically.
export async function ensureAgentLogSource(deviceId: string, deviceLabel: string, siteName: string): Promise<LogSourceRow> {
  const db = await getDb();

  const existing = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("siteName", sql.NVarChar, siteName)
    .query<LogSourceRow>(`
      SELECT Id, ProtectedApplicationId, Name, AdapterType, Enabled, ConfigJson, LastPositionFile, LastPosition, LastFileSize
      FROM SecurityLogSources WHERE SourceDeviceId = @deviceId AND SourceSiteName = @siteName
    `);
  if (existing.recordset[0]) return existing.recordset[0];

  const appName = `${deviceLabel} - IIS ${siteName}`;
  const appResult = await db
    .request()
    .input("name", sql.NVarChar, appName)
    .query<{ Id: number }>(`
      INSERT INTO SecurityProtectedApplications (Name, AppType, Notes)
      OUTPUT INSERTED.Id
      VALUES (@name, 'Server', 'Auto-registered from an endpoint agent''s forwarded IIS access log')
    `);
  const protectedApplicationId = appResult.recordset[0].Id;

  const sourceName = `${deviceLabel} - IIS ${siteName} (agent)`;
  const sourceResult = await db
    .request()
    .input("appId", sql.Int, protectedApplicationId)
    .input("name", sql.NVarChar, sourceName)
    .input("deviceId", sql.VarChar, deviceId)
    .input("siteName", sql.NVarChar, siteName)
    .query<{ Id: number }>(`
      INSERT INTO SecurityLogSources (ProtectedApplicationId, Name, AdapterType, ConfigJson, SourceDeviceId, SourceSiteName)
      OUTPUT INSERTED.Id
      VALUES (@appId, @name, 'AgentWebLog', '{}', @deviceId, @siteName)
    `);

  return {
    Id: sourceResult.recordset[0].Id,
    ProtectedApplicationId: protectedApplicationId,
    Name: sourceName,
    AdapterType: "AgentWebLog",
    Enabled: true,
    ConfigJson: "{}",
    LastPositionFile: null,
    LastPosition: 0,
    LastFileSize: null,
  };
}
