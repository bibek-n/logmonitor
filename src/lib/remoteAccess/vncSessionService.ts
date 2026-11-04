import sharp from "sharp";
import { getDb, sql } from "../db";
import { writeAuditEvent } from "./auditLog";
import { getConnection, getCredentialSecret, recordConnectionCheckResult } from "./repository";
import { RfbClient } from "./vnc/rfbClient";
import { keyToKeysym } from "./vnc/keysyms";

// In-process session manager for in-browser VNC viewing, following the exact same pattern as
// connectionService.ts's Terminal sessions (in-memory Map keyed by RemoteSessions.Id, one real
// protocol client kept alive per session). The one real difference: this app's hosting
// (IIS/iisnode) can't run a persistent WebSocket well, so instead of pushing a live byte stream
// to the browser, this backend keeps its own VNC connection warm and continuously re-requests
// framebuffer updates on a short timer, re-encoding the latest frame to JPEG (via `sharp`,
// already a dependency) for the browser to poll - the same "HTTP long/short-poll instead of a
// persistent connection" architecture already used for Terminal output and Remote Support
// signaling on this exact stack.

interface ActiveVncSession {
  client: RfbClient;
  connectionId: number;
  startedByUserId: number;
  sessionId: number;
  width: number;
  height: number;
  latestJpeg: Buffer | null;
  frameSeq: number;
  lastActivityAt: number;
  closed: boolean;
  requestTimer: ReturnType<typeof setInterval>;
}

const sessions = new Map<number, ActiveVncSession>();

const FRAME_REQUEST_INTERVAL_MS = 200; // ~5fps backend pull against the real VNC server
const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // no /frame poll or input for 2 minutes -> assume the browser tab closed
const JPEG_QUALITY = 55;

function encodeFrame(session: ActiveVncSession, client: RfbClient) {
  sharp(client.frameBuffer, { raw: { width: client.width, height: client.height, channels: 4 } })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer()
    .then((jpeg) => {
      if (session.closed) return;
      session.latestJpeg = jpeg;
      session.frameSeq += 1;
    })
    .catch(() => {
      // A transient encode failure just means this one frame is skipped - the next successful
      // one updates latestJpeg as normal. Not worth failing the whole session over.
    });
}

export async function startVncSession(opts: { connectionId: number; userId: number; username: string }): Promise<{ sessionId: number; width: number; height: number }> {
  const connection = await getConnection(opts.connectionId);
  if (!connection) throw new Error("Connection not found");
  const host = connection.hostname || connection.ipAddress;
  if (!host) throw new Error("Connection has no hostname or IP address");

  let password: string | undefined;
  if (connection.credentialId) {
    const cred = await getCredentialSecret(connection.credentialId);
    if (cred) password = cred.secret;
  }

  const startedAt = Date.now();
  const db = await getDb();

  return new Promise((resolve, reject) => {
    const client = new RfbClient({ host, port: connection.port, password, connectTimeoutMs: connection.connectionTimeoutSeconds * 1000 });
    let settled = false;

    const onEarlyError = async (err: Error) => {
      if (settled) return;
      settled = true;
      await recordConnectionCheckResult(opts.connectionId, "Offline", null, err.message);
      await writeAuditEvent({
        eventType: "ConnectionFailed",
        userId: opts.userId,
        username: opts.username,
        protocol: "VNC",
        connectionId: opts.connectionId,
        host,
        result: "Failure",
        failureReason: err.message,
        durationMs: Date.now() - startedAt,
      });
      reject(err);
    };
    client.once("error", onEarlyError);

    client.once("ready", async (info) => {
      if (settled) return;
      settled = true;
      client.removeListener("error", onEarlyError);

      try {
        const sessionResult = await db
          .request()
          .input("connectionId", sql.Int, opts.connectionId)
          .input("sessionType", sql.VarChar, "Vnc")
          .input("protocol", sql.VarChar, "VNC")
          .input("targetHost", sql.NVarChar, host)
          .input("targetPort", sql.Int, connection.port)
          .input("userId", sql.Int, opts.userId)
          .input("username", sql.NVarChar, opts.username)
          .query<{ Id: number }>(`
            INSERT INTO RemoteSessions (ConnectionId, SessionType, Protocol, TargetHost, TargetPort, StartedByUserId, StartedByUsername, RecordingStatus, CreatedByUserId, UpdatedByUserId)
            OUTPUT INSERTED.Id
            VALUES (@connectionId, @sessionType, @protocol, @targetHost, @targetPort, @userId, @username, 'NotRecorded', @userId, @userId)
          `);
        const sessionId = sessionResult.recordset[0].Id;

        const active: ActiveVncSession = {
          client,
          connectionId: opts.connectionId,
          startedByUserId: opts.userId,
          sessionId,
          width: info.width,
          height: info.height,
          latestJpeg: null,
          frameSeq: 0,
          lastActivityAt: Date.now(),
          closed: false,
          requestTimer: setInterval(() => client.requestUpdate(true), FRAME_REQUEST_INTERVAL_MS),
        };
        client.on("frame", () => encodeFrame(active, client));
        client.on("error", () => void endVncSession(sessionId, "Failed"));
        client.on("close", () => void endVncSession(sessionId, "Ended"));
        sessions.set(sessionId, active);

        await recordConnectionCheckResult(opts.connectionId, "Online", Date.now() - startedAt, null);
        await writeAuditEvent({
          eventType: "ConnectionStarted",
          userId: opts.userId,
          username: opts.username,
          protocol: "VNC",
          connectionId: opts.connectionId,
          host,
          sessionId,
          result: "Success",
          durationMs: Date.now() - startedAt,
        });
        resolve({ sessionId, width: info.width, height: info.height });
      } catch (err) {
        client.disconnect();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

export function getVncFrame(sessionId: number, since: number): { frameSeq: number; image: string | null; closed: boolean } | null {
  const active = sessions.get(sessionId);
  if (!active) return null;
  active.lastActivityAt = Date.now();
  if (active.frameSeq === since || !active.latestJpeg) {
    return { frameSeq: active.frameSeq, image: null, closed: active.closed };
  }
  return { frameSeq: active.frameSeq, image: `data:image/jpeg;base64,${active.latestJpeg.toString("base64")}`, closed: active.closed };
}

export function sendVncPointer(sessionId: number, x: number, y: number, buttonMask: number): boolean {
  const active = sessions.get(sessionId);
  if (!active || active.closed) return false;
  active.lastActivityAt = Date.now();
  active.client.sendPointerEvent(x, y, buttonMask);
  return true;
}

export function sendVncKey(sessionId: number, key: string, down: boolean): boolean {
  const active = sessions.get(sessionId);
  if (!active || active.closed) return false;
  const keysym = keyToKeysym(key);
  if (keysym === null) return true; // unsupported key - silently ignored, not a failure
  active.lastActivityAt = Date.now();
  active.client.sendKeyEvent(keysym, down);
  return true;
}

export async function endVncSession(sessionId: number, status: "Ended" | "Terminated" | "Failed"): Promise<void> {
  const active = sessions.get(sessionId);
  if (active) {
    active.closed = true;
    clearInterval(active.requestTimer);
    active.client.disconnect();
    sessions.delete(sessionId);
  }
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, sessionId)
    .input("status", sql.VarChar, status === "Failed" ? "Failed" : status)
    .query(
      "UPDATE RemoteSessions SET Status = @status, EndedAt = SYSUTCDATETIME() WHERE Id = @id AND Status = 'Active'"
    );
}

export function getVncSessionOwner(sessionId: number): number | null {
  return sessions.get(sessionId)?.startedByUserId ?? null;
}

// Closes any VNC session whose browser tab has stopped polling for frames (and sent no input)
// for IDLE_TIMEOUT_MS - the frontend polls every ~250ms while open, so two full minutes of
// silence reliably means the tab was closed or navigated away, not just a slow poll.
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, active] of sessions) {
    if (now - active.lastActivityAt > IDLE_TIMEOUT_MS) {
      void endVncSession(sessionId, "Ended");
    }
  }
}, 30_000);
