import { getDb, sql } from "@/lib/db";
import { sanitizeEvidence } from "./redaction";
import type { NormalizedSecurityEvent } from "./shared";

// Inserts one normalized event and keeps the per-IP rollup (SecurityIpProfiles) current -
// the rollup is what risk scoring and the dashboard's "top source IPs" both read, so it's
// updated inline with every event rather than recomputed later.
export async function insertSecurityEvent(event: NormalizedSecurityEvent): Promise<number> {
  const db = await getDb();

  const result = await db
    .request()
    .input("logSourceId", sql.Int, event.logSourceId)
    .input("protectedApplicationId", sql.Int, event.protectedApplicationId)
    .input("dataSource", sql.VarChar, event.dataSource)
    .input("eventTime", sql.DateTime2, new Date(event.eventTime))
    .input("sourceIp", sql.VarChar, event.sourceIp)
    .input("destinationHost", sql.NVarChar, event.destinationHost)
    .input("requestMethod", sql.VarChar, event.requestMethod)
    .input("requestPath", sql.NVarChar, event.requestPath)
    .input("responseStatus", sql.Int, event.responseStatus)
    .input("userAgent", sql.NVarChar, event.userAgent)
    .input("userAccount", sql.NVarChar, event.userAccount)
    .input("evidenceSummary", sql.NVarChar, sanitizeEvidence(event.evidenceSummary))
    .input("fieldsJson", sql.NVarChar, JSON.stringify(event.fields ?? {}))
    .query<{ Id: number }>(`
      INSERT INTO SecurityEvents
        (LogSourceId, ProtectedApplicationId, DataSource, EventTime, SourceIp, DestinationHost, RequestMethod, RequestPath, ResponseStatus, UserAgent, UserAccount, EvidenceSummary, FieldsJson)
      OUTPUT INSERTED.Id
      VALUES
        (@logSourceId, @protectedApplicationId, @dataSource, @eventTime, @sourceIp, @destinationHost, @requestMethod, @requestPath, @responseStatus, @userAgent, @userAccount, @evidenceSummary, @fieldsJson)
    `);

  if (event.sourceIp) {
    await db
      .request()
      .input("ip", sql.VarChar, event.sourceIp)
      .query(`
        MERGE SecurityIpProfiles AS target
        USING (SELECT @ip AS IpAddress) AS src
        ON target.IpAddress = src.IpAddress
        WHEN MATCHED THEN UPDATE SET LastSeenAt = SYSUTCDATETIME(), TotalEvents = TotalEvents + 1, UpdatedAt = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (IpAddress, TotalEvents) VALUES (@ip, 1);
      `);
  }

  return result.recordset[0].Id;
}

export async function insertSecurityEvents(events: NormalizedSecurityEvent[]): Promise<number[]> {
  const ids: number[] = [];
  for (const event of events) {
    ids.push(await insertSecurityEvent(event));
  }
  return ids;
}

export interface LogSourceRow {
  Id: number;
  ProtectedApplicationId: number;
  Name: string;
  AdapterType: string;
  Enabled: boolean;
  ConfigJson: string;
  LastPositionFile: string | null;
  LastPosition: number;
  LastFileSize: number | null;
}

export async function getEnabledLogSources(): Promise<LogSourceRow[]> {
  const db = await getDb();
  const result = await db.query<LogSourceRow>(
    `SELECT Id, ProtectedApplicationId, Name, AdapterType, Enabled, ConfigJson, LastPositionFile, LastPosition, LastFileSize FROM SecurityLogSources WHERE Enabled = 1`
  );
  return result.recordset;
}

export async function updateLogSourcePosition(logSourceId: number, filePath: string, position: number, fileSize: number): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, logSourceId)
    .input("filePath", sql.NVarChar, filePath)
    .input("position", sql.BigInt, position)
    .input("fileSize", sql.BigInt, fileSize)
    .query(`
      UPDATE SecurityLogSources
      SET LastPositionFile = @filePath, LastPosition = @position, LastFileSize = @fileSize, LastRunAt = SYSUTCDATETIME(), LastRunStatus = 'Success', LastErrorMessage = NULL, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);
}

export async function markLogSourceError(logSourceId: number, message: string): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, logSourceId)
    .input("message", sql.NVarChar, message.slice(0, 1000))
    .query(`UPDATE SecurityLogSources SET LastRunAt = SYSUTCDATETIME(), LastRunStatus = 'Failed', LastErrorMessage = @message, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id`);
}

export async function recordCollectorHealth(logSourceId: number | null, status: "Healthy" | "Degraded" | "Failed", message: string | null, eventsProcessed: number, durationMs: number): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("logSourceId", sql.Int, logSourceId)
    .input("status", sql.VarChar, status)
    .input("message", sql.NVarChar, message)
    .input("eventsProcessed", sql.Int, eventsProcessed)
    .input("durationMs", sql.Int, durationMs)
    .query(`INSERT INTO SecurityCollectorHealth (LogSourceId, Status, Message, EventsProcessedLastRun, DurationMs) VALUES (@logSourceId, @status, @message, @eventsProcessed, @durationMs)`);
}
