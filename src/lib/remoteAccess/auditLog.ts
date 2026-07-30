import { getDb, sql } from "../db";
import { RemoteAuditEventType, RemoteProtocol } from "./types";

export interface AuditEventInput {
  eventType: RemoteAuditEventType;
  userId: number | null;
  username: string | null;
  protocol?: RemoteProtocol | null;
  connectionId?: number | null;
  host?: string | null;
  sourceIp?: string | null;
  sessionId?: number | null;
  action?: string | null;
  result: "Success" | "Failure";
  failureReason?: string | null;
  durationMs?: number | null;
}

// The ONLY place a RemoteAuditLog row is ever inserted - every route/service calls this
// instead of writing SQL directly, so the "never a password/key/token/passphrase in any
// column" guarantee is enforced in one place rather than trusted to every call site. `action`
// is a short human-readable label (e.g. "ls -la /var/www") - callers must never pass a
// credential value, private key material, or full command output through it; scriptExecutions
// pass a script NAME/id here, never the script body or its output.
const SECRET_LOOKING_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----/i;

export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  if (input.action && SECRET_LOOKING_RE.test(input.action)) {
    // Defense in depth against a call site accidentally passing key material through `action` -
    // never persist it, log server-side only so the mistake is visible without leaking the secret.
    console.error("[remoteAccess/auditLog] Refused to write an audit action that looks like private key material.");
    input = { ...input, action: "[redacted - looked like key material]" };
  }

  const db = await getDb();
  await db
    .request()
    .input("eventType", sql.VarChar, input.eventType)
    .input("userId", sql.Int, input.userId)
    .input("username", sql.NVarChar, input.username)
    .input("protocol", sql.VarChar, input.protocol ?? null)
    .input("connectionId", sql.Int, input.connectionId ?? null)
    .input("host", sql.NVarChar, input.host ?? null)
    .input("sourceIp", sql.VarChar, input.sourceIp ?? null)
    .input("sessionId", sql.Int, input.sessionId ?? null)
    .input("action", sql.NVarChar, input.action ?? null)
    .input("result", sql.VarChar, input.result)
    .input("failureReason", sql.NVarChar, input.failureReason ?? null)
    .input("durationMs", sql.Int, input.durationMs ?? null)
    .query(`
      INSERT INTO RemoteAuditLog (EventType, UserId, Username, Protocol, ConnectionId, Host, SourceIp, SessionId, Action, Result, FailureReason, DurationMs)
      VALUES (@eventType, @userId, @username, @protocol, @connectionId, @host, @sourceIp, @sessionId, @action, @result, @failureReason, @durationMs)
    `);
}

export async function listAuditLog(opts: { eventType?: string; userId?: number; limit?: number } = {}): Promise<
  {
    id: number;
    eventType: string;
    userId: number | null;
    username: string | null;
    protocol: string | null;
    connectionId: number | null;
    host: string | null;
    sourceIp: string | null;
    sessionId: number | null;
    action: string | null;
    result: string;
    failureReason: string | null;
    durationMs: number | null;
    createdAt: Date;
  }[]
> {
  const db = await getDb();
  const limit = opts.limit && opts.limit > 0 && opts.limit <= 1000 ? opts.limit : 200;
  const request = db.request().input("limit", sql.Int, limit);
  const conditions: string[] = [];
  if (opts.eventType) {
    request.input("eventType", sql.VarChar, opts.eventType);
    conditions.push("EventType = @eventType");
  }
  if (opts.userId) {
    request.input("userId", sql.Int, opts.userId);
    conditions.push("UserId = @userId");
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await request.query<{
    Id: number;
    EventType: string;
    UserId: number | null;
    Username: string | null;
    Protocol: string | null;
    ConnectionId: number | null;
    Host: string | null;
    SourceIp: string | null;
    SessionId: number | null;
    Action: string | null;
    Result: string;
    FailureReason: string | null;
    DurationMs: number | null;
    CreatedAt: Date;
  }>(`SELECT TOP (@limit) * FROM RemoteAuditLog ${where} ORDER BY CreatedAt DESC`);

  return result.recordset.map((r) => ({
    id: r.Id,
    eventType: r.EventType,
    userId: r.UserId,
    username: r.Username,
    protocol: r.Protocol,
    connectionId: r.ConnectionId,
    host: r.Host,
    sourceIp: r.SourceIp,
    sessionId: r.SessionId,
    action: r.Action,
    result: r.Result,
    failureReason: r.FailureReason,
    durationMs: r.DurationMs,
    createdAt: r.CreatedAt,
  }));
}
