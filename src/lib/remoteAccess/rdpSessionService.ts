import sharp from "sharp";
import { getDb, sql } from "../db";
import { writeAuditEvent } from "./auditLog";
import { getConnection, getCredentialSecret, recordConnectionCheckResult } from "./repository";
import { GuacdClient } from "./guacd/guacdClient";
import { keyToKeysym } from "./vnc/keysyms";

// In-process session manager for in-browser RDP viewing via guacd - the RDP counterpart of
// vncSessionService.ts, same polling-frame architecture and same reasoning for why (this app's
// IIS/iisnode hosting can't run a persistent WebSocket well). The one structural difference: the
// real protocol work for RDP happens over the network inside guacd itself (running on 192.168.1.13,
// reached through a local SSH tunnel on 127.0.0.1:4822 - see [[project_logmonitor_remote_access_module]]),
// so GuacdClient only has to speak the much simpler Guacamole text protocol to a local socket
// rather than RDP itself.

interface ActiveRdpSession {
  client: GuacdClient;
  connectionId: number;
  startedByUserId: number;
  sessionId: number;
  width: number;
  height: number;
  latestJpeg: Buffer | null;
  frameSeq: number;
  lastActivityAt: number;
  closed: boolean;
}

const sessions = new Map<number, ActiveRdpSession>();

const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // no /frame poll or input for 2 minutes -> assume the browser tab closed
const JPEG_QUALITY = 55;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;

function encodeFrame(session: ActiveRdpSession, client: GuacdClient) {
  sharp(client.frameBuffer, { raw: { width: client.width, height: client.height, channels: 4 } })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer()
    .then((jpeg) => {
      if (session.closed) return;
      session.latestJpeg = jpeg;
      session.width = client.width;
      session.height = client.height;
      session.frameSeq += 1;
    })
    .catch(() => {
      // A transient encode failure just means this one frame is skipped - the next sync'd one
      // updates latestJpeg as normal. Not worth failing the whole session over.
    });
}

export async function startRdpSession(opts: {
  connectionId: number;
  userId: number;
  username: string;
  width?: number;
  height?: number;
}): Promise<{ sessionId: number; width: number; height: number }> {
  const connection = await getConnection(opts.connectionId);
  if (!connection) throw new Error("Connection not found");
  const host = connection.hostname || connection.ipAddress;
  if (!host) throw new Error("Connection has no hostname or IP address");

  let password: string | undefined;
  if (connection.credentialId) {
    const cred = await getCredentialSecret(connection.credentialId);
    if (cred) password = cred.secret;
  }

  const width = opts.width && opts.width > 0 ? opts.width : DEFAULT_WIDTH;
  const height = opts.height && opts.height > 0 ? opts.height : DEFAULT_HEIGHT;
  const startedAt = Date.now();
  const db = await getDb();

  return new Promise((resolve, reject) => {
    const client = new GuacdClient({
      host,
      port: connection.port,
      username: connection.username,
      password,
      domain: connection.domain,
      width,
      height,
      connectTimeoutMs: connection.connectionTimeoutSeconds * 1000,
    });
    let settled = false;

    const onEarlyError = async (err: Error) => {
      if (settled) return;
      settled = true;
      await recordConnectionCheckResult(opts.connectionId, "Offline", null, err.message);
      await writeAuditEvent({
        eventType: "ConnectionFailed",
        userId: opts.userId,
        username: opts.username,
        protocol: "RDP",
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
          .input("sessionType", sql.VarChar, "Rdp")
          .input("protocol", sql.VarChar, "RDP")
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

        const active: ActiveRdpSession = {
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
        };
        client.on("frame", () => encodeFrame(active, client));
        client.on("error", () => void endRdpSession(sessionId, "Failed"));
        client.on("close", () => void endRdpSession(sessionId, "Ended"));
        sessions.set(sessionId, active);

        await recordConnectionCheckResult(opts.connectionId, "Online", Date.now() - startedAt, null);
        await writeAuditEvent({
          eventType: "ConnectionStarted",
          userId: opts.userId,
          username: opts.username,
          protocol: "RDP",
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

export function getRdpFrame(sessionId: number, since: number): { frameSeq: number; image: string | null; closed: boolean; width: number; height: number } | null {
  const active = sessions.get(sessionId);
  if (!active) return null;
  active.lastActivityAt = Date.now();
  if (active.frameSeq === since || !active.latestJpeg) {
    return { frameSeq: active.frameSeq, image: null, closed: active.closed, width: active.width, height: active.height };
  }
  return {
    frameSeq: active.frameSeq,
    image: `data:image/jpeg;base64,${active.latestJpeg.toString("base64")}`,
    closed: active.closed,
    width: active.width,
    height: active.height,
  };
}

export function sendRdpPointer(sessionId: number, x: number, y: number, buttonMask: number): boolean {
  const active = sessions.get(sessionId);
  if (!active || active.closed) return false;
  active.lastActivityAt = Date.now();
  active.client.sendPointerEvent(x, y, buttonMask);
  return true;
}

export function sendRdpKey(sessionId: number, key: string, down: boolean): boolean {
  const active = sessions.get(sessionId);
  if (!active || active.closed) return false;
  const keysym = keyToKeysym(key);
  if (keysym === null) return true; // unsupported key - silently ignored, not a failure
  active.lastActivityAt = Date.now();
  active.client.sendKeyEvent(keysym, down);
  return true;
}

export async function endRdpSession(sessionId: number, status: "Ended" | "Terminated" | "Failed"): Promise<void> {
  const active = sessions.get(sessionId);
  if (active) {
    active.closed = true;
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

export function getRdpSessionOwner(sessionId: number): number | null {
  return sessions.get(sessionId)?.startedByUserId ?? null;
}

// Closes any RDP session whose browser tab has stopped polling for frames (and sent no input)
// for IDLE_TIMEOUT_MS - same reasoning as vncSessionService's idle sweep.
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, active] of sessions) {
    if (now - active.lastActivityAt > IDLE_TIMEOUT_MS) {
      void endRdpSession(sessionId, "Ended");
    }
  }
}, 30_000);
