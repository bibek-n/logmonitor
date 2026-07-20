import { NextRequest } from "next/server";
import { getDb, sql } from "./db";

// QA module's own detail audit trail (QaActivityLogs) — records before/after values for a
// specific entity, in addition to (not instead of) the app-wide AdminAuditLog every other
// module's mutations already write to via logAdminAction(). QA routes call both: this one
// for the rich per-entity detail the spec's audit requirements ask for, logAdminAction() for
// the coarse "what happened" trail consistent with the rest of the app.
function clientIp(req?: NextRequest): string | null {
  if (!req) return null;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}

export async function logQaActivity(opts: {
  entityType: string;
  entityId: number;
  action: string;
  userId: number | null;
  previousValue?: unknown;
  newValue?: unknown;
  req?: NextRequest;
}): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("entityType", sql.VarChar, opts.entityType)
    .input("entityId", sql.Int, opts.entityId)
    .input("action", sql.VarChar, opts.action)
    .input("previousValue", sql.NVarChar, opts.previousValue !== undefined ? JSON.stringify(opts.previousValue) : null)
    .input("newValue", sql.NVarChar, opts.newValue !== undefined ? JSON.stringify(opts.newValue) : null)
    .input("userId", sql.Int, opts.userId)
    .input("ipAddress", sql.VarChar, clientIp(opts.req))
    .query(
      `INSERT INTO QaActivityLogs (EntityType, EntityId, Action, PreviousValue, NewValue, UserId, IpAddress)
       VALUES (@entityType, @entityId, @action, @previousValue, @newValue, @userId, @ipAddress)`
    );
}
