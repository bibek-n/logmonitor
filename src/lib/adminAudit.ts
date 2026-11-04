import { NextRequest } from "next/server";
import crypto from "crypto";
import { getDb, sql } from "./db";
import type { AdminSession } from "./requireAdmin";
import { getClientIp } from "./clientIp";

const GENESIS_HASH = "0".repeat(64);

function clientIp(req?: NextRequest): string | null {
  return req ? getClientIp(req.headers) : null;
}

function computeRowHash(
  prevHash: string,
  fields: {
    userId: number;
    username: string;
    section: string;
    action: string;
    details: string | null;
    ipAddress: string | null;
  }
): string {
  const payload = [
    prevHash,
    fields.userId,
    fields.username,
    fields.section,
    fields.action,
    fields.details ?? "",
    fields.ipAddress ?? "",
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export async function logAdminAction(opts: {
  admin: AdminSession;
  section: string;
  action: string;
  details?: string;
  req?: NextRequest;
  // Pre-extracted IP, for callers running in a background continuation after their
  // response has already been sent â€” the original `req` object shouldn't be read that
  // late (see the comment at the fire-and-forget call site in the manual scan route),
  // so they extract the IP synchronously up front and pass it here instead of `req`.
  ipAddress?: string | null;
}): Promise<void> {
  const db = await getDb();
  const userId = opts.admin.userId;
  const username = opts.admin.username;
  const section = opts.section;
  const action = opts.action;
  const details = opts.details ?? null;
  const ipAddress = opts.ipAddress !== undefined ? opts.ipAddress : clientIp(opts.req);

  // Serialize appenders so PrevHash always chains off the true last row: the
  // UPDLOCK+HOLDLOCK read blocks concurrent admin actions from computing their
  // hash off the same "last row" and forking the chain.
  const transaction = new sql.Transaction(db);
  await transaction.begin();
  try {
    const prevResult = await new sql.Request(transaction).query(
      "SELECT TOP 1 RowHash FROM AdminAuditLog WITH (UPDLOCK, HOLDLOCK) ORDER BY Id DESC"
    );
    const prevHash: string = prevResult.recordset[0]?.RowHash ?? GENESIS_HASH;
    const rowHash = computeRowHash(prevHash, { userId, username, section, action, details, ipAddress });

    await new sql.Request(transaction)
      .input("userId", sql.Int, userId)
      .input("username", sql.NVarChar, username)
      .input("section", sql.NVarChar, section)
      .input("action", sql.NVarChar, action)
      .input("details", sql.NVarChar, details)
      .input("ipAddress", sql.NVarChar, ipAddress)
      .input("prevHash", sql.VarChar, prevHash)
      .input("rowHash", sql.VarChar, rowHash)
      .query(
        "INSERT INTO AdminAuditLog (UserId, Username, Section, Action, Details, IpAddress, PrevHash, RowHash) VALUES (@userId, @username, @section, @action, @details, @ipAddress, @prevHash, @rowHash)"
      );

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export interface AuditChainVerificationResult {
  ok: boolean;
  totalRows: number;
  checkedRows: number;
  brokenAtId?: number;
  reason?: string;
}

// Rows written before the hash-chain columns existed have NULL PrevHash/RowHash and are
// skipped rather than treated as a break - the chain only covers history from the point
// it was introduced onward, not retroactively.
export async function verifyAuditChain(): Promise<AuditChainVerificationResult> {
  const db = await getDb();
  const result = await db
    .request()
    .query(
      "SELECT Id, UserId, Username, Section, Action, Details, IpAddress, PrevHash, RowHash FROM AdminAuditLog ORDER BY Id ASC"
    );

  let expectedPrevHash = GENESIS_HASH;
  let chainStarted = false;
  let checkedRows = 0;

  for (const row of result.recordset) {
    if (row.RowHash === null) continue;

    if (!chainStarted) {
      expectedPrevHash = GENESIS_HASH;
      chainStarted = true;
    }

    if (row.PrevHash !== expectedPrevHash) {
      return {
        ok: false,
        totalRows: result.recordset.length,
        checkedRows,
        brokenAtId: row.Id,
        reason: `Row ${row.Id}: stored PrevHash does not match the prior row's RowHash`,
      };
    }

    const recomputed = computeRowHash(row.PrevHash, {
      userId: row.UserId,
      username: row.Username,
      section: row.Section,
      action: row.Action,
      details: row.Details,
      ipAddress: row.IpAddress,
    });

    if (recomputed !== row.RowHash) {
      return {
        ok: false,
        totalRows: result.recordset.length,
        checkedRows,
        brokenAtId: row.Id,
        reason: `Row ${row.Id}: stored RowHash does not match its recomputed hash (row contents may have been altered)`,
      };
    }

    expectedPrevHash = row.RowHash;
    checkedRows += 1;
  }

  return { ok: true, totalRows: result.recordset.length, checkedRows };
}
