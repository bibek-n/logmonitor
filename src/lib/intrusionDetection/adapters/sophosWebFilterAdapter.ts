import { getDb, sql } from "@/lib/db";
import type { AdapterResult } from "./types";
import type { LogSourceRow } from "../store";

const BATCH_SIZE = 1000;

interface WebFilterRow {
  Id: number;
  ReceivedAt: string;
  SrcIp: string | null;
  DstIp: string | null;
  HttpMethod: string | null;
  Url: string | null;
  Domain: string | null;
  Category: string | null;
  CategoryType: string | null;
  Action: string | null;
  UserName: string | null;
}

// In practice this Sophos device leaves Domain/Category/Action null on most/all rows (only
// Url is reliably populated) - parse a hostname out of the URL as a fallback so
// destinationHost (and therefore website-domain attribution, see websiteSync.ts) still
// works even when Domain itself is empty.
function extractHostname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Reads new rows from the existing WebFilterLogs table (Sophos web-filter allow/deny
// decisions). This is a genuinely useful signal source for admin/sensitive-path targeting
// and scanner-like behavior, even though it's filter decisions rather than raw HTTP access
// logs - a client repeatedly hitting Denied categories or admin-looking URLs is exactly the
// kind of pattern the detection rules in this Phase look for.
export async function collectSophosWebFilter(logSource: LogSourceRow): Promise<AdapterResult> {
  const db = await getDb();
  const lastId = logSource.LastPosition;

  const result = await db
    .request()
    .input("lastId", sql.BigInt, lastId)
    .input("top", sql.Int, BATCH_SIZE)
    .query<WebFilterRow>(`
      SELECT TOP (@top) Id, ReceivedAt, SrcIp, DstIp, HttpMethod, Url, Domain, Category, CategoryType, Action, UserName
      FROM WebFilterLogs
      WHERE Id > @lastId
      ORDER BY Id ASC
    `);

  const rows = result.recordset;
  const events = rows.map((r) => ({
    logSourceId: logSource.Id,
    protectedApplicationId: logSource.ProtectedApplicationId,
    dataSource: "sophos_webfilter" as const,
    eventTime: new Date(r.ReceivedAt).toISOString(),
    sourceIp: r.SrcIp,
    destinationHost: r.Domain || extractHostname(r.Url),
    requestMethod: r.HttpMethod,
    requestPath: r.Url,
    responseStatus: null,
    userAgent: null,
    userAccount: r.UserName && r.UserName !== "-" ? r.UserName : null,
    evidenceSummary: `${r.Action ?? "?"} - ${r.Category ?? "uncategorized"}${r.Url ? `: ${r.Url}` : ""}`,
    fields: {
      category: r.Category,
      categoryType: r.CategoryType,
      action: r.Action,
    },
  }));

  const newPosition = rows.length > 0 ? rows[rows.length - 1].Id : lastId;
  return { events, newPosition };
}
