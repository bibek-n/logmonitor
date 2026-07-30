import crypto from "crypto";
import { getDb, sql } from "@/lib/db";
import { isDeviceOnline } from "./presence";
import { issueTurnCredential } from "./turnCredentials";
import { SessionStateError, type RemoteSupportSessionRow, type RemoteSupportSessionStatus } from "./types";
import type { IceServerConfig } from "./types";

const REQUEST_TTL_SECONDS = 60;

function generateNonce(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Constant-time compare, same reasoning as agentAuth.ts's API-key check: a nonce is a secret
// the caller must prove knowledge of, and string equality (`===`) leaks timing information
// about how many leading characters matched.
function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function logSessionEvent(sessionId: number, eventType: string, details: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("sessionId", sql.Int, sessionId)
    .input("eventType", sql.VarChar, eventType)
    .input("detailsJson", sql.NVarChar, JSON.stringify(details))
    .query("INSERT INTO RemoteSessionEvents (SessionId, EventType, DetailsJson) VALUES (@sessionId, @eventType, @detailsJson)");
}

export interface CreateSessionRequestOptions {
  deviceId: string;
  requestedByUserId: number;
  reason: string;
  sourceIp: string;
  permissions?: string;
}

export interface CreateSessionRequestResult {
  sessionId: number;
  sessionGuid: string;
  expiresAt: string;
}

// Step 1-3 of the consent workflow: admin picks a device + reason, backend creates a Pending
// row with a short expiry. Deliberately does NOT touch RemoteSessionSignaling or issue any
// credential yet - those only exist once the employee has actually approved (see
// respondToSessionRequest below), which is the property the "session cannot begin without
// valid employee approval" test asserts.
export async function createSessionRequest(opts: CreateSessionRequestOptions): Promise<CreateSessionRequestResult> {
  if (!opts.reason.trim()) throw new SessionStateError("A support reason is required", "REASON_REQUIRED");
  if (opts.reason.length > 500) throw new SessionStateError("Reason is too long", "REASON_TOO_LONG");

  const db = await getDb();

  const deviceResult = await db
    .request()
    .input("deviceId", sql.VarChar, opts.deviceId)
    .query<{ LastHeartbeat: string | null }>("SELECT LastHeartbeat FROM Devices WHERE DeviceId = @deviceId");
  const device = deviceResult.recordset[0];
  if (!device) throw new SessionStateError("Device not found", "DEVICE_NOT_FOUND");
  if (!isDeviceOnline(device.LastHeartbeat)) throw new SessionStateError("Device is offline", "DEVICE_OFFLINE");

  const existing = await db
    .request()
    .input("deviceId", sql.VarChar, opts.deviceId)
    .query<{ Cnt: number }>(
      "SELECT COUNT(*) AS Cnt FROM RemoteSupportSessions WHERE DeviceId = @deviceId AND Status IN ('Pending','Approved','Active')"
    );
  if ((existing.recordset[0]?.Cnt ?? 0) > 0) {
    throw new SessionStateError("This device already has a pending or active support session", "DEVICE_BUSY");
  }

  const approvalNonce = generateNonce();
  const expiresAt = new Date(Date.now() + REQUEST_TTL_SECONDS * 1000);

  const insertResult = await db
    .request()
    .input("deviceId", sql.VarChar, opts.deviceId)
    .input("requestedByUserId", sql.Int, opts.requestedByUserId)
    .input("reason", sql.NVarChar, opts.reason)
    .input("approvalNonce", sql.VarChar, approvalNonce)
    .input("expiresAt", sql.DateTime2, expiresAt)
    .input("permissionsGranted", sql.VarChar, opts.permissions ?? "view")
    .input("sourceIp", sql.VarChar, opts.sourceIp)
    .query<{ Id: number; SessionGuid: string }>(`
      INSERT INTO RemoteSupportSessions (DeviceId, RequestedByUserId, Reason, ApprovalNonce, ExpiresAt, PermissionsGranted, SourceIp)
      OUTPUT INSERTED.Id, INSERTED.SessionGuid
      VALUES (@deviceId, @requestedByUserId, @reason, @approvalNonce, @expiresAt, @permissionsGranted, @sourceIp)
    `);

  const row = insertResult.recordset[0];
  await logSessionEvent(row.Id, "Requested", { reason: opts.reason, sourceIp: opts.sourceIp });

  return { sessionId: row.Id, sessionGuid: row.SessionGuid, expiresAt: expiresAt.toISOString() };
}

export async function getSessionById(sessionId: number): Promise<RemoteSupportSessionRow | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, sessionId)
    .query<RemoteSupportSessionRow>("SELECT * FROM RemoteSupportSessions WHERE Id = @id");
  return result.recordset[0] ?? null;
}

// A device only ever has at most one Pending session at a time (enforced in
// createSessionRequest above), so "the pending session for this device" is a safe, unambiguous
// lookup - this is what chattray's consent-detection poll uses.
export async function getPendingSessionForDevice(deviceId: string): Promise<RemoteSupportSessionRow | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<RemoteSupportSessionRow>(
      "SELECT TOP 1 * FROM RemoteSupportSessions WHERE DeviceId = @deviceId AND Status = 'Pending' ORDER BY Id DESC"
    );
  return result.recordset[0] ?? null;
}

// Unlike getPendingSessionForDevice, this returns the most recent session regardless of
// status - used once a session has moved past Pending (Approved/Active/Ended) so both
// chattray (to detect the Active transition and start the real WebRTC session) and the
// consent web page (to switch its own UI from "waiting for approval" to "active"/"ended")
// can poll one simple "what's going on with my device right now" endpoint.
export async function getLatestSessionForDevice(deviceId: string): Promise<RemoteSupportSessionRow | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<RemoteSupportSessionRow>("SELECT TOP 1 * FROM RemoteSupportSessions WHERE DeviceId = @deviceId ORDER BY Id DESC");
  return result.recordset[0] ?? null;
}

async function markExpired(sessionId: number): Promise<void> {
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, sessionId)
    .query("UPDATE RemoteSupportSessions SET Status = 'Expired' WHERE Id = @id AND Status = 'Pending'");
  if ((result.rowsAffected[0] ?? 0) > 0) {
    await logSessionEvent(sessionId, "Expired", {});
  }
}

export interface RespondToSessionRequestOptions {
  sessionId: number;
  deviceId: string;
  nonce: string;
  approved: boolean;
}

export interface RespondToSessionRequestResult {
  status: RemoteSupportSessionStatus;
  iceServers?: IceServerConfig[];
}

// Steps 5-8 of the consent workflow. This is the ONLY function that can move a session into
// 'Active', and every guard here is load-bearing:
//   - the row must still be Pending (can't approve twice, can't approve after rejection)
//   - it must belong to the device presenting it (device auth already proved identity;
//     this closes the gap where a compromised OTHER device tries to approve a session it
//     was never asked about)
//   - it must not be expired
//   - the nonce must match exactly, in constant time
// Only once ALL of those hold does capture/input become possible - the DB row transitioning
// to 'Active' is the single source of truth every other route checks against.
export async function respondToSessionRequest(opts: RespondToSessionRequestOptions): Promise<RespondToSessionRequestResult> {
  const db = await getDb();

  const result = await db
    .request()
    .input("id", sql.Int, opts.sessionId)
    .query<{ Id: number; DeviceId: string; Status: RemoteSupportSessionStatus; ApprovalNonce: string; ExpiresAt: string }>(
      "SELECT Id, DeviceId, Status, ApprovalNonce, ExpiresAt FROM RemoteSupportSessions WHERE Id = @id"
    );
  const row = result.recordset[0];
  if (!row) throw new SessionStateError("Session not found", "NOT_FOUND");
  if (row.DeviceId !== opts.deviceId) throw new SessionStateError("Session does not belong to this device", "DEVICE_MISMATCH");
  if (row.Status !== "Pending") throw new SessionStateError("Session is no longer pending", "NOT_PENDING");

  if (new Date(row.ExpiresAt).getTime() < Date.now()) {
    await markExpired(opts.sessionId);
    throw new SessionStateError("This support request has expired", "EXPIRED");
  }

  if (!timingSafeEqualStrings(row.ApprovalNonce, opts.nonce)) {
    throw new SessionStateError("Invalid approval code", "BAD_NONCE");
  }

  const newStatus: RemoteSupportSessionStatus = opts.approved ? "Active" : "Rejected";
  await db
    .request()
    .input("id", sql.Int, opts.sessionId)
    .input("approved", sql.Bit, opts.approved)
    .input("status", sql.VarChar, newStatus)
    .query(`
      UPDATE RemoteSupportSessions SET
        Status = @status,
        Approved = @approved,
        RespondedAt = SYSUTCDATETIME(),
        StartedAt = CASE WHEN @approved = 1 THEN SYSUTCDATETIME() ELSE StartedAt END
      WHERE Id = @id
    `);

  await logSessionEvent(opts.sessionId, opts.approved ? "Approved" : "Rejected", {});

  if (!opts.approved) return { status: "Rejected" };

  const turn = issueTurnCredential(opts.sessionId);
  return { status: "Active", iceServers: turn.iceServers };
}

export interface EndSessionOptions {
  sessionId: number;
  terminationReason: string;
  requestedByDeviceId?: string;
  requestedByAdminUserId?: number;
}

// Either party can end unilaterally (step 10 of the workflow) - this function doesn't care
// which side called it, only that the session was actually live. Ending an already-ended
// session is a no-op error, not a crash, since both sides may race to end at once.
export async function endSession(opts: EndSessionOptions): Promise<void> {
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, opts.sessionId)
    .input("reason", sql.VarChar, opts.terminationReason)
    .query(`
      UPDATE RemoteSupportSessions SET Status = 'Ended', EndedAt = SYSUTCDATETIME(), TerminationReason = @reason
      WHERE Id = @id AND Status IN ('Approved', 'Active')
    `);

  if ((result.rowsAffected[0] ?? 0) === 0) {
    throw new SessionStateError("Session is not active", "NOT_ACTIVE");
  }

  await logSessionEvent(opts.sessionId, "Ended", {
    reason: opts.terminationReason,
    endedByDevice: opts.requestedByDeviceId ?? null,
    endedByAdminUserId: opts.requestedByAdminUserId ?? null,
  });
}

// Called opportunistically (e.g. when an admin or agent asks for session status) rather than
// on a fixed schedule - this app has no background-job runner suitable for a sub-minute sweep,
// so "expire on read" is the pragmatic equivalent: nobody can act on a stale Pending row
// because every mutating path (respond/end) re-checks ExpiresAt itself anyway. This just keeps
// the Status column honest for display purposes.
export async function expireIfPastDeadline(session: RemoteSupportSessionRow): Promise<RemoteSupportSessionRow> {
  if (session.Status === "Pending" && new Date(session.ExpiresAt).getTime() < Date.now()) {
    await markExpired(session.Id);
    return { ...session, Status: "Expired" };
  }
  return session;
}
