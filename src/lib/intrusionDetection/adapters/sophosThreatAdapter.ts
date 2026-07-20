import { getDb, sql } from "@/lib/db";
import type { AdapterResult } from "./types";
import type { LogSourceRow } from "../store";

const BATCH_SIZE = 1000;

interface SophosThreatRow {
  Id: number;
  ReceivedAt: string;
  LogType: string | null;
  LogComponent: string | null;
  LogSubtype: string | null;
  SrcIp: string | null;
  DstIp: string | null;
  Severity: string | null;
  Status: string | null;
  RawMessage: string | null;
}

// Reads new rows from the existing SophosThreatLogs table (Firewall/IPS/Anti-Virus/ATP/
// Wireless events already ingested by syslog/listener.ts's handleThreat()) - "incremental"
// here means tracking the last processed Id (an IDENTITY column, monotonic) rather than a
// file byte offset, since this source is a DB table, not a file.
export async function collectSophosThreat(logSource: LogSourceRow): Promise<AdapterResult> {
  const db = await getDb();
  const lastId = logSource.LastPosition;

  const result = await db
    .request()
    .input("lastId", sql.BigInt, lastId)
    .input("top", sql.Int, BATCH_SIZE)
    .query<SophosThreatRow>(`
      SELECT TOP (@top) Id, ReceivedAt, LogType, LogComponent, LogSubtype, SrcIp, DstIp, Severity, Status, RawMessage
      FROM SophosThreatLogs
      WHERE Id > @lastId
      ORDER BY Id ASC
    `);

  const rows = result.recordset;
  const events = rows.map((r) => ({
    logSourceId: logSource.Id,
    protectedApplicationId: logSource.ProtectedApplicationId,
    dataSource: "sophos_threat" as const,
    eventTime: new Date(r.ReceivedAt).toISOString(),
    sourceIp: r.SrcIp,
    destinationHost: r.DstIp,
    requestMethod: null,
    requestPath: null,
    responseStatus: null,
    userAgent: null,
    userAccount: null,
    evidenceSummary: r.RawMessage,
    fields: {
      logType: r.LogType,
      logComponent: r.LogComponent,
      logSubtype: r.LogSubtype,
      severity: r.Severity,
      status: r.Status,
    },
  }));

  const newPosition = rows.length > 0 ? rows[rows.length - 1].Id : lastId;
  return { events, newPosition };
}
