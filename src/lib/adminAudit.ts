import { NextRequest } from "next/server";
import { getDb, sql } from "./db";
import type { AdminSession } from "./requireAdmin";

function clientIp(req?: NextRequest): string | null {
  if (!req) return null;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}

export async function logAdminAction(opts: {
  admin: AdminSession;
  section: string;
  action: string;
  details?: string;
  req?: NextRequest;
  // Pre-extracted IP, for callers running in a background continuation after their
  // response has already been sent — the original `req` object shouldn't be read that
  // late (see the comment at the fire-and-forget call site in the manual scan route),
  // so they extract the IP synchronously up front and pass it here instead of `req`.
  ipAddress?: string | null;
}): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("userId", sql.Int, opts.admin.userId)
    .input("username", sql.NVarChar, opts.admin.username)
    .input("section", sql.NVarChar, opts.section)
    .input("action", sql.NVarChar, opts.action)
    .input("details", sql.NVarChar, opts.details ?? null)
    .input("ipAddress", sql.NVarChar, opts.ipAddress !== undefined ? opts.ipAddress : clientIp(opts.req))
    .query(
      "INSERT INTO AdminAuditLog (UserId, Username, Section, Action, Details, IpAddress) VALUES (@userId, @username, @section, @action, @details, @ipAddress)"
    );
}
