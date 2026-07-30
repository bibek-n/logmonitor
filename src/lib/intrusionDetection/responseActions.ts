import { getDb, sql } from "@/lib/db";

// Two action types are offered, both genuinely enforceable end to end:
//
// - "block_ip": writes to SecurityIpBlocklist, which scripts/run-waf-firewall-sync.ts (already
//   built/deployed, runs on its own schedule) diffs against real Windows Firewall rules on this
//   host - executing this action does not touch the firewall directly, it hands off to that
//   existing, already-idempotent enforcement job, exactly like the blocklist API route does.
// - "disable_account": flips Users.IsActive = 0, the same column/toggle the Settings > Users
//   admin UI already uses (src/app/api/admin/settings/users/[id]/route.ts) - blocks all FUTURE
//   logins immediately.
//
// A third "kill_session" action is deliberately NOT offered: this app uses NextAuth's stateless
// JWT session strategy with no server-side session store, and requireAdmin()/the JWT callback
// never re-check Users.IsActive per request - so there is no real mechanism to invalidate an
// already-issued session token short of rotating NEXTAUTH_SECRET app-wide (which would log out
// every user, not just one). Building a "kill session" button that silently does nothing to an
// attacker's live session would be worse than not offering it - disable_account is the honest,
// practical equivalent (stops the attacker from re-authenticating once their current token
// expires) and its limitation is stated explicitly in the Result field below.

export type ResponseActionType = "block_ip" | "disable_account";
export const RESPONSE_ACTION_TYPES: ResponseActionType[] = ["block_ip", "disable_account"];

export type ResponseActionStatus = "Pending" | "Simulated" | "Executed" | "Failed" | "RolledBack";

// Same strict validation used by scripts/run-waf-firewall-sync.ts before that value is ever
// interpolated into a PowerShell -Command string - kept in sync deliberately.
const IP_OR_CIDR_RE = /^[0-9a-fA-F:.]+(\/\d{1,3})?$/;
const USERNAME_RE = /^[a-zA-Z0-9._-]{2,100}$/;

export interface ResponseActionRow {
  id: number;
  alertId: number | null;
  actionType: ResponseActionType;
  targetValue: string;
  status: ResponseActionStatus;
  dryRun: boolean;
  requestedByUsername: string | null;
  requestedAt: string;
  executedAt: string | null;
  result: string | null;
  expiresAt: string | null;
}

interface ActionDbRow {
  Id: number;
  AlertId: number | null;
  ActionType: string;
  TargetValue: string;
  Status: string;
  DryRun: boolean;
  RequestedByUsername: string | null;
  RequestedAt: string;
  ExecutedAt: string | null;
  Result: string | null;
  ExpiresAt: string | null;
}

function toRow(r: ActionDbRow): ResponseActionRow {
  return {
    id: r.Id, alertId: r.AlertId, actionType: r.ActionType as ResponseActionType, targetValue: r.TargetValue,
    status: r.Status as ResponseActionStatus, dryRun: r.DryRun, requestedByUsername: r.RequestedByUsername,
    requestedAt: r.RequestedAt, executedAt: r.ExecutedAt, result: r.Result, expiresAt: r.ExpiresAt,
  };
}

export function validateTarget(actionType: ResponseActionType, targetValue: string): string | null {
  if (actionType === "block_ip" && !IP_OR_CIDR_RE.test(targetValue)) {
    return "Target must be a plain IP address or CIDR range (e.g. 203.0.113.5 or 203.0.113.0/24).";
  }
  if (actionType === "disable_account" && !USERNAME_RE.test(targetValue)) {
    return "Target must be a valid username (letters, numbers, dots, underscores, hyphens only).";
  }
  return null;
}

export async function listActions(filter: { status?: string; alertId?: number } = {}): Promise<ResponseActionRow[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const req = db.request();
  if (filter.status) {
    conditions.push("Status = @status");
    req.input("status", sql.VarChar, filter.status);
  }
  if (filter.alertId) {
    conditions.push("AlertId = @alertId");
    req.input("alertId", sql.Int, filter.alertId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await req.query<ActionDbRow>(`SELECT * FROM SecurityResponseActions ${where} ORDER BY RequestedAt DESC`);
  return result.recordset.map(toRow);
}

// Dry-run is the default (matches SecurityResponseActions.DryRun default 1) - requesting an
// action never touches anything by itself; a separate explicit executeAction() call is always
// required, so an analyst reviewing an alert can queue up an action for a second admin to
// approve/execute rather than it firing immediately.
export async function requestAction(input: {
  alertId: number | null;
  actionType: ResponseActionType;
  targetValue: string;
  requestedByUserId: number;
  requestedByUsername: string;
  dryRun: boolean;
  expiresAt: Date | null;
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const validationError = validateTarget(input.actionType, input.targetValue);
  if (validationError) return { ok: false, error: validationError };

  const db = await getDb();
  const result = await db
    .request()
    .input("alertId", sql.Int, input.alertId)
    .input("actionType", sql.VarChar, input.actionType)
    .input("targetValue", sql.NVarChar, input.targetValue)
    .input("status", sql.VarChar, input.dryRun ? "Simulated" : "Pending")
    .input("dryRun", sql.Bit, input.dryRun)
    .input("requestedByUserId", sql.Int, input.requestedByUserId)
    .input("requestedByUsername", sql.NVarChar, input.requestedByUsername)
    .input("expiresAt", sql.DateTime2, input.expiresAt)
    .query<{ Id: number }>(`
      INSERT INTO SecurityResponseActions (AlertId, ActionType, TargetValue, Status, DryRun, RequestedByUserId, RequestedByUsername, ExpiresAt)
      OUTPUT INSERTED.Id
      VALUES (@alertId, @actionType, @targetValue, @status, @dryRun, @requestedByUserId, @requestedByUsername, @expiresAt)
    `);
  return { ok: true, id: result.recordset[0].Id };
}

async function blockIp(ipOrCidr: string, reason: string, actor: { userId: number }): Promise<string> {
  const db = await getDb();
  const existing = await db.request().input("ip", sql.VarChar, ipOrCidr).query<{ Id: number }>("SELECT Id FROM SecurityIpBlocklist WHERE IpOrCidr = @ip AND IsActive = 1");
  if (existing.recordset[0]) return `${ipOrCidr} is already on the active blocklist.`;

  await db
    .request()
    .input("ip", sql.VarChar, ipOrCidr)
    .input("reason", sql.NVarChar, reason)
    .input("userId", sql.Int, actor.userId)
    .query("INSERT INTO SecurityIpBlocklist (IpOrCidr, Reason, Source, CreatedByUserId) VALUES (@ip, @reason, 'Auto', @userId)");
  return `Added ${ipOrCidr} to the IP blocklist. Enforced as a Windows Firewall block rule by the WAF sync job (runs on its own schedule, typically within a few minutes).`;
}

async function disableAccount(username: string): Promise<string> {
  const db = await getDb();
  const user = await db.request().input("username", sql.NVarChar, username).query<{ Id: number; IsActive: boolean }>("SELECT Id, IsActive FROM Users WHERE Username = @username");
  const row = user.recordset[0];
  if (!row) return `No user found with username "${username}" - no action taken.`;
  if (!row.IsActive) return `Account "${username}" was already disabled.`;

  await db.request().input("id", sql.Int, row.Id).query("UPDATE Users SET IsActive = 0 WHERE Id = @id");
  return `Account "${username}" disabled - blocked from future logins. Note: this does not revoke an already-active session for this user (this app has no server-side session store); the session remains valid until it naturally expires.`;
}

// Executes a Pending or Simulated action. A "Simulated" (dry-run) action can still be executed
// later - dry-run only controls what happened when it was first requested, not a lock on ever
// executing it for real.
export async function executeAction(id: number, actor: { userId: number }): Promise<{ ok: true; result: string } | { ok: false; error: string }> {
  const db = await getDb();
  const row = await db.request().input("id", sql.Int, id).query<ActionDbRow>("SELECT * FROM SecurityResponseActions WHERE Id = @id");
  const action = row.recordset[0];
  if (!action) return { ok: false, error: "Response action not found." };
  if (action.Status === "Executed" || action.Status === "RolledBack") return { ok: false, error: `Action is already ${action.Status}.` };

  try {
    let result: string;
    if (action.ActionType === "block_ip") {
      result = await blockIp(action.TargetValue, `Response action #${id}${action.AlertId ? ` for alert #${action.AlertId}` : ""}`, actor);
    } else if (action.ActionType === "disable_account") {
      result = await disableAccount(action.TargetValue);
    } else {
      return { ok: false, error: `Unknown action type: ${action.ActionType}` };
    }

    await db.request().input("id", sql.Int, id).input("result", sql.NVarChar, result).query(
      "UPDATE SecurityResponseActions SET Status = 'Executed', ExecutedAt = SYSUTCDATETIME(), Result = @result WHERE Id = @id"
    );
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    await db.request().input("id", sql.Int, id).input("result", sql.NVarChar, message).query("UPDATE SecurityResponseActions SET Status = 'Failed', Result = @result WHERE Id = @id");
    return { ok: false, error: message };
  }
}

// Reverses an executed action where technically possible - re-enables the account, or
// deactivates the blocklist entry (the next WAF sync run removes the corresponding firewall
// rule). Response actions must be reversible where technically possible, matching the same
// design principle already documented on the blocklist API route.
export async function rollbackAction(id: number): Promise<{ ok: true; result: string } | { ok: false; error: string }> {
  const db = await getDb();
  const row = await db.request().input("id", sql.Int, id).query<ActionDbRow>("SELECT * FROM SecurityResponseActions WHERE Id = @id");
  const action = row.recordset[0];
  if (!action) return { ok: false, error: "Response action not found." };
  if (action.Status !== "Executed") return { ok: false, error: `Only an Executed action can be rolled back (current status: ${action.Status}).` };

  let result: string;
  if (action.ActionType === "block_ip") {
    await db.request().input("ip", sql.VarChar, action.TargetValue).query("UPDATE SecurityIpBlocklist SET IsActive = 0 WHERE IpOrCidr = @ip");
    result = `Removed ${action.TargetValue} from the active blocklist. The firewall rule will be removed by the next WAF sync run.`;
  } else if (action.ActionType === "disable_account") {
    const user = await db.request().input("username", sql.NVarChar, action.TargetValue).query<{ Id: number }>("SELECT Id FROM Users WHERE Username = @username");
    if (!user.recordset[0]) return { ok: false, error: `No user found with username "${action.TargetValue}" - cannot roll back.` };
    await db.request().input("id", sql.Int, user.recordset[0].Id).query("UPDATE Users SET IsActive = 1 WHERE Id = @id");
    result = `Account "${action.TargetValue}" re-enabled.`;
  } else {
    return { ok: false, error: `Unknown action type: ${action.ActionType}` };
  }

  await db.request().input("id", sql.Int, id).input("result", sql.NVarChar, result).query("UPDATE SecurityResponseActions SET Status = 'RolledBack', Result = @result WHERE Id = @id");
  return { ok: true, result };
}
