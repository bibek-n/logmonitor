import { getDb, sql } from "@/lib/db";
import type { AdapterResult } from "./types";
import type { LogSourceRow } from "../store";

const BATCH_SIZE = 1000;

interface LoginActivityRow {
  Id: number;
  CreatedAt: string;
  Username: string;
  IpAddress: string | null;
  UserAgent: string | null;
  Success: boolean;
  FailureReason: string | null;
}

// Reads new rows from the existing LoginActivity table (populated by every NextAuth
// authorize() call - src/lib/authOptions.ts - for both the password+OTP flow and the
// passkey flow). This is the primary auth-log source for brute-force / credential-stuffing
// / excessive-failed-authentication detection.
export async function collectLoginActivity(logSource: LogSourceRow): Promise<AdapterResult> {
  const db = await getDb();
  const lastId = logSource.LastPosition;

  const result = await db
    .request()
    .input("lastId", sql.Int, lastId)
    .input("top", sql.Int, BATCH_SIZE)
    .query<LoginActivityRow>(`
      SELECT TOP (@top) Id, CreatedAt, Username, IpAddress, UserAgent, Success, FailureReason
      FROM LoginActivity
      WHERE Id > @lastId
      ORDER BY Id ASC
    `);

  const rows = result.recordset;
  const events = rows.map((r) => ({
    logSourceId: logSource.Id,
    protectedApplicationId: logSource.ProtectedApplicationId,
    dataSource: "admin_audit_log" as const,
    eventTime: new Date(r.CreatedAt).toISOString(),
    sourceIp: r.IpAddress,
    destinationHost: null,
    requestMethod: "POST",
    requestPath: "/api/auth/callback/credentials",
    responseStatus: r.Success ? 200 : 401,
    userAgent: r.UserAgent,
    userAccount: r.Username,
    evidenceSummary: r.Success ? `Successful login for ${r.Username}` : `Failed login for ${r.Username}: ${r.FailureReason ?? "unknown reason"}`,
    fields: {
      success: r.Success,
      failureReason: r.FailureReason,
    },
  }));

  const newPosition = rows.length > 0 ? rows[rows.length - 1].Id : lastId;
  return { events, newPosition };
}
