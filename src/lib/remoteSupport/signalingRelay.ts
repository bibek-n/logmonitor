import { getDb, sql } from "@/lib/db";
import type { SignalDirection, SignalMessageType } from "./types";

export interface SignalMessage {
  id: number;
  messageType: SignalMessageType;
  payload: string;
}

// HTTP long-poll signaling relay (see Phase 1 architecture doc §6 for why this isn't a
// WebSocket): the admin browser and the agent each write to one direction and poll-consume
// the other, using the exact same short-poll shape this app already relies on everywhere else
// (heartbeat, chat-unread, notifications) rather than introducing a persistent-connection
// service this hosting environment (IIS/iisnode) isn't well suited to run.
export async function enqueueSignalMessage(
  sessionId: number,
  direction: SignalDirection,
  messageType: SignalMessageType,
  payload: string
): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("sessionId", sql.Int, sessionId)
    .input("direction", sql.VarChar, direction)
    .input("messageType", sql.VarChar, messageType)
    .input("payload", sql.NVarChar, payload)
    .query(
      "INSERT INTO RemoteSessionSignaling (SessionId, Direction, MessageType, Payload) VALUES (@sessionId, @direction, @messageType, @payload)"
    );
}

// Consumes (marks read) every unconsumed message for this session/direction and returns them
// in order - a one-shot pop, not a re-readable subscription, matching the notifications
// route's "advance the watermark" pattern.
export async function pollSignalMessages(sessionId: number, direction: SignalDirection): Promise<SignalMessage[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("sessionId", sql.Int, sessionId)
    .input("direction", sql.VarChar, direction)
    .query<{ Id: number; MessageType: SignalMessageType; Payload: string }>(
      `SELECT Id, MessageType, Payload FROM RemoteSessionSignaling
       WHERE SessionId = @sessionId AND Direction = @direction AND ConsumedAt IS NULL
       ORDER BY Id ASC`
    );

  if (result.recordset.length === 0) return [];

  const ids = result.recordset.map((r) => r.Id);
  await db
    .request()
    .input("sessionId", sql.Int, sessionId)
    .query(`UPDATE RemoteSessionSignaling SET ConsumedAt = SYSUTCDATETIME() WHERE SessionId = @sessionId AND Id IN (${ids.join(",")})`);

  return result.recordset.map((r) => ({ id: r.Id, messageType: r.MessageType, payload: r.Payload }));
}
