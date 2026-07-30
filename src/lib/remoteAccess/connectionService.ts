import net from "net";
import { NodeSSH } from "node-ssh";
import type { ClientChannel } from "ssh2";
import { getDb, sql } from "../db";
import { writeAuditEvent } from "./auditLog";
import { getConnection, getCredentialSecret, getSshPrivateKey, recordConnectionCheckResult } from "./repository";
import type { AvailabilityStatus, RemoteProtocol } from "./types";

// In-process singleton session manager - deliberate Phase 1 choice, not an oversight (see the
// approved plan's "Backend connection-service architecture" section). Every live SSH/SFTP
// session this module holds survives exactly as long as any other in-memory, per-process-
// lifetime state already accepted elsewhere in this app (e.g. Remote Support's rate limiter).
const OUTPUT_CAP_BYTES = 512 * 1024; // per session - bounded so a runaway remote process can't grow memory unbounded

// Session recording (Phase 3): every Terminal session's I/O is persisted to RemoteSessionLogs as
// it happens, capped per-session at RECORDING_CAP_BYTES - much larger than the live in-memory
// ring buffer above since a full transcript is meant to be reviewable after the session ends,
// not just tailed live. Once the cap is hit, further bytes are silently dropped from the
// persisted transcript (the live view is unaffected - only the durable recording stops growing).
const RECORDING_CAP_BYTES = 5 * 1024 * 1024;

interface ActiveSession {
  ssh: NodeSSH;
  channel: ClientChannel;
  connectionId: number | null;
  startedByUserId: number;
  output: string;
  cursor: number;
  closed: boolean;
  sessionId: number;
  logSequence: number;
  recordedBytes: number;
}

const sessions = new Map<number, ActiveSession>();

async function resolveAuthForConnection(connectionId: number | null, explicit?: { password?: string | null; sshKeyId?: number | null }) {
  if (!connectionId) {
    return { password: explicit?.password ?? undefined, privateKey: undefined as string | undefined };
  }
  const connection = await getConnection(connectionId);
  if (!connection) throw new Error("Connection not found");

  let password: string | undefined;
  let privateKey: string | undefined;
  if (connection.sshKeyId) {
    const key = await getSshPrivateKey(connection.sshKeyId);
    if (key) privateKey = key.privateKeyPem;
  } else if (connection.credentialId) {
    const cred = await getCredentialSecret(connection.credentialId);
    if (cred) password = cred.secret;
  }
  return { password, privateKey, connection };
}

// Dials a saved connection, transparently tunneling through its configured jump host (one hop)
// via ssh2's forwardOut - the target ssh2 client connects over that forwarded channel (the
// `sock` option) instead of a direct TCP host:port. The jump host's own NodeSSH instance is kept
// alive for the lifetime of the tunnel and disposed when the forwarded channel closes.
export async function dialSshForConnection(connectionId: number): Promise<NodeSSH> {
  const connection = await getConnection(connectionId);
  if (!connection) throw new Error("Connection not found");
  const auth = await resolveAuthForConnection(connectionId);
  const host = connection.hostname || connection.ipAddress || "";
  const ssh = new NodeSSH();

  if (connection.jumpHostConnectionId) {
    const jumpAuth = await resolveAuthForConnection(connection.jumpHostConnectionId);
    const jumpConnection = jumpAuth.connection;
    if (!jumpConnection) throw new Error("Jump host connection not found");
    const jumpSsh = new NodeSSH();
    await jumpSsh.connect({
      host: jumpConnection.hostname || jumpConnection.ipAddress || "",
      port: jumpConnection.port,
      username: jumpConnection.username || "",
      password: jumpAuth.password,
      privateKey: jumpAuth.privateKey,
      readyTimeout: 15_000,
    });
    const channel = await jumpSsh.forwardOut("127.0.0.1", 0, host, connection.port);
    channel.on("close", () => jumpSsh.dispose());
    await ssh.connect({
      sock: channel,
      username: connection.username || "",
      password: auth.password,
      privateKey: auth.privateKey,
      readyTimeout: 15_000,
    });
    return ssh;
  }

  await ssh.connect({
    host,
    port: connection.port,
    username: connection.username || "",
    password: auth.password,
    privateKey: auth.privateKey,
    readyTimeout: 15_000,
  });
  return ssh;
}

// Opens a real SSH connection + interactive shell channel, and registers it as a RemoteSessions
// row. The browser never sends a command string to exec here - it only ever sends raw
// keystroke bytes once the session exists (see appendInput below), which is what makes this
// safe against command injection by construction.
export async function startTerminalSession(opts: {
  connectionId: number | null;
  adHoc?: { hostname: string; port: number; username: string; password?: string; privateKey?: string; passphrase?: string };
  userId: number;
  username: string;
}): Promise<number> {
  const db = await getDb();
  const target = opts.adHoc
    ? { host: opts.adHoc.hostname, port: opts.adHoc.port, username: opts.adHoc.username, password: opts.adHoc.password, privateKey: opts.adHoc.privateKey, passphrase: opts.adHoc.passphrase }
    : await (async () => {
        const connection = await getConnection(opts.connectionId as number);
        if (!connection) throw new Error("Connection not found");
        return {
          host: connection.hostname || connection.ipAddress || "",
          port: connection.port,
          username: connection.username || "",
        };
      })();

  const startedAt = Date.now();
  let ssh: NodeSSH | undefined;
  try {
    // A saved connection with a jump host configured dials through dialSshForConnection (which
    // tunnels via forwardOut); an ad-hoc Quick Connect target dials directly - jump hosts aren't
    // wired into Quick Connect's ad-hoc path yet.
    if (!opts.adHoc && opts.connectionId) {
      ssh = await dialSshForConnection(opts.connectionId);
    } else {
      ssh = new NodeSSH();
      await ssh.connect({
        host: target.host,
        port: target.port,
        username: target.username,
        password: opts.adHoc?.password,
        privateKey: opts.adHoc?.privateKey,
        passphrase: opts.adHoc?.passphrase,
        readyTimeout: 15_000,
      });
    }
    const channel = await ssh.requestShell({ term: "xterm-256color" });

    const sessionResult = await db
      .request()
      .input("connectionId", sql.Int, opts.connectionId)
      .input("sessionType", sql.VarChar, "Terminal")
      .input("protocol", sql.VarChar, "SSH")
      .input("targetHost", sql.NVarChar, target.host)
      .input("targetPort", sql.Int, target.port)
      .input("isAdHoc", sql.Bit, !!opts.adHoc)
      .input("userId", sql.Int, opts.userId)
      .input("username", sql.NVarChar, opts.username)
      .query<{ Id: number }>(`
        INSERT INTO RemoteSessions (ConnectionId, SessionType, Protocol, TargetHost, TargetPort, IsAdHoc, StartedByUserId, StartedByUsername, RecordingStatus, CreatedByUserId, UpdatedByUserId)
        OUTPUT INSERTED.Id
        VALUES (@connectionId, @sessionType, @protocol, @targetHost, @targetPort, @isAdHoc, @userId, @username, 'Recording', @userId, @userId)
      `);
    const sessionId = sessionResult.recordset[0].Id;

    const active: ActiveSession = { ssh, channel, connectionId: opts.connectionId, startedByUserId: opts.userId, output: "", cursor: 0, closed: false, sessionId, logSequence: 0, recordedBytes: 0 };
    channel.on("data", (chunk: Buffer) => appendOutput(active, chunk.toString("utf8")));
    channel.stderr?.on("data", (chunk: Buffer) => appendOutput(active, chunk.toString("utf8")));
    channel.on("close", () => {
      active.closed = true;
      void endSession(sessionId, "Ended");
    });
    sessions.set(sessionId, active);

    if (opts.connectionId) await recordConnectionCheckResult(opts.connectionId, "Online", Date.now() - startedAt, null);
    await writeAuditEvent({
      eventType: "ConnectionStarted",
      userId: opts.userId,
      username: opts.username,
      protocol: "SSH",
      connectionId: opts.connectionId,
      host: target.host,
      sessionId,
      result: "Success",
      durationMs: Date.now() - startedAt,
    });

    return sessionId;
  } catch (err) {
    ssh?.dispose();
    if (opts.connectionId) await recordConnectionCheckResult(opts.connectionId, "Offline", null, err instanceof Error ? err.message : String(err));
    await writeAuditEvent({
      eventType: "ConnectionFailed",
      userId: opts.userId,
      username: opts.username,
      protocol: "SSH",
      connectionId: opts.connectionId,
      host: target.host,
      result: "Failure",
      failureReason: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}

async function persistSessionLog(active: ActiveSession, direction: "Input" | "Output", content: string): Promise<void> {
  if (active.recordedBytes >= RECORDING_CAP_BYTES || !content) return;
  active.recordedBytes += content.length;
  active.logSequence += 1;
  const db = await getDb();
  await db
    .request()
    .input("sessionId", sql.Int, active.sessionId)
    .input("sequence", sql.BigInt, active.logSequence)
    .input("direction", sql.VarChar, direction)
    .input("content", sql.NVarChar(sql.MAX), content)
    .query("INSERT INTO RemoteSessionLogs (SessionId, Sequence, Direction, Content) VALUES (@sessionId, @sequence, @direction, @content)");
}

function appendOutput(active: ActiveSession, text: string) {
  active.output += text;
  if (active.output.length > OUTPUT_CAP_BYTES) {
    const overflow = active.output.length - OUTPUT_CAP_BYTES;
    active.output = active.output.slice(overflow);
    active.cursor += overflow; // cursor stays meaningful even after trimming the head
  }
  void persistSessionLog(active, "Output", text).catch(() => {
    // Recording is best-effort - a transient DB hiccup must never interrupt the live session.
  });
}

export function getTerminalOutput(sessionId: number, since: number): { output: string; cursor: number; closed: boolean } | null {
  const active = sessions.get(sessionId);
  if (!active) return null;
  const from = Math.max(0, since - active.cursor);
  return { output: active.output.slice(from), cursor: active.cursor + active.output.length, closed: active.closed };
}

export function sendTerminalInput(sessionId: number, data: string): boolean {
  const active = sessions.get(sessionId);
  if (!active || active.closed) return false;
  active.channel.write(data);
  void persistSessionLog(active, "Input", data).catch(() => {});
  return true;
}

export async function endSession(sessionId: number, status: "Ended" | "Terminated"): Promise<void> {
  const active = sessions.get(sessionId);
  if (active) {
    try {
      active.channel.end();
    } catch {
      // already closed - fine
    }
    active.ssh.dispose();
    sessions.delete(sessionId);
  }
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, sessionId)
    .input("status", sql.VarChar, status)
    .query(
      "UPDATE RemoteSessions SET Status = @status, EndedAt = SYSUTCDATETIME(), RecordingStatus = CASE WHEN RecordingStatus = 'Recording' THEN 'Recorded' ELSE RecordingStatus END WHERE Id = @id AND Status = 'Active'"
    );
}

export function getActiveSessionOwner(sessionId: number): number | null {
  return sessions.get(sessionId)?.startedByUserId ?? null;
}

// --- SFTP (independent of any open Terminal session) -----------------------------------------

export async function withSftp<T>(connectionId: number, fn: (ssh: NodeSSH) => Promise<T>): Promise<T> {
  const ssh = await dialSshForConnection(connectionId);
  try {
    return await fn(ssh);
  } finally {
    ssh.dispose();
  }
}

// --- One-off command execution (Restart/Shut Down device actions, future Scripts execution) ---
// A single exec, not a persistent interactive shell - opens its own short-lived SSH connection,
// runs one command, and disconnects. Every call site passes a fixed, non-user-supplied command
// string (e.g. "shutdown /r /t 0" or "sudo reboot") - never string-built from request input -
// so this can't become a command-injection vector.
export async function runRemoteCommand(connectionId: number, command: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const ssh = await dialSshForConnection(connectionId);
  try {
    const result = await ssh.execCommand(command);
    return { stdout: result.stdout, stderr: result.stderr, code: result.code };
  } finally {
    ssh.dispose();
  }
}

// --- SFTP file operations (independent of any open Terminal session) --------------------------

export interface RemoteFileEntry {
  name: string;
  isDirectory: boolean;
  sizeBytes: number;
  modifiedAt: Date;
  permissions: string;
}

// Dispatches by protocol so the file-transfer API routes never need to know whether a given
// connection is SSH/SFTP/SCP (goes over SFTP) or FTP/FTPS (goes over basic-ftp) - see
// ftpService.ts for the Phase 2 FTP/FTPS implementation.
async function isFtpConnection(connectionId: number): Promise<boolean> {
  const connection = await getConnection(connectionId);
  return connection?.protocol === "FTP" || connection?.protocol === "FTPS";
}

export async function listRemoteDirectory(connectionId: number, remotePath: string): Promise<RemoteFileEntry[]> {
  if (await isFtpConnection(connectionId)) {
    const { listFtpDirectory } = await import("./ftpService");
    return listFtpDirectory(connectionId, remotePath);
  }
  return withSftp(connectionId, async (ssh) => {
    const sftp = await ssh.requestSFTP();
    return new Promise<RemoteFileEntry[]>((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) return reject(err);
        resolve(
          list.map((entry) => ({
            name: entry.filename,
            isDirectory: (entry.attrs.mode & 0o170000) === 0o040000,
            sizeBytes: entry.attrs.size,
            modifiedAt: new Date(entry.attrs.mtime * 1000),
            permissions: (entry.attrs.mode & 0o777).toString(8),
          }))
        );
      });
    });
  });
}

export async function uploadFileViaSftp(connectionId: number, localPath: string, remotePath: string): Promise<void> {
  if (await isFtpConnection(connectionId)) {
    const { uploadFileViaFtp } = await import("./ftpService");
    return uploadFileViaFtp(connectionId, localPath, remotePath);
  }
  await withSftp(connectionId, (ssh) => ssh.putFile(localPath, remotePath));
}

export async function downloadFileViaSftp(connectionId: number, remotePath: string, localPath: string): Promise<void> {
  if (await isFtpConnection(connectionId)) {
    const { downloadFileViaFtp } = await import("./ftpService");
    return downloadFileViaFtp(connectionId, remotePath, localPath);
  }
  await withSftp(connectionId, (ssh) => ssh.getFile(localPath, remotePath));
}

export async function deleteRemoteFile(connectionId: number, remotePath: string, isDirectory: boolean): Promise<void> {
  if (await isFtpConnection(connectionId)) {
    const { deleteFtpEntry } = await import("./ftpService");
    return deleteFtpEntry(connectionId, remotePath, isDirectory);
  }
  await withSftp(connectionId, async (ssh) => {
    const sftp = await ssh.requestSFTP();
    return new Promise<void>((resolve, reject) => {
      const cb = (err: Error | null | undefined) => (err ? reject(err) : resolve());
      if (isDirectory) sftp.rmdir(remotePath, cb);
      else sftp.unlink(remotePath, cb);
    });
  });
}

export async function mkdirRemote(connectionId: number, remotePath: string): Promise<void> {
  if (await isFtpConnection(connectionId)) {
    const { mkdirFtp } = await import("./ftpService");
    return mkdirFtp(connectionId, remotePath);
  }
  await withSftp(connectionId, async (ssh) => {
    const sftp = await ssh.requestSFTP();
    return new Promise<void>((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => (err ? reject(err) : resolve()));
    });
  });
}

// --- Reachability check ------------------------------------------------------------------------
// Shared by BOTH the manual "Test Connection" button and the scheduled Connection Checker (see
// scripts/run-remote-access-connection-check.ts) - a single source of truth for "is this
// connection reachable," which is the concrete fix for the "status never updates" failure class
// flagged in the approved plan's Context section. A plain TCP connect (not a full protocol
// handshake) works uniformly across every supported protocol without needing protocol-specific
// probing logic for Phase 1.
export function checkTcpReachability(host: string, port: number, timeoutMs: number): Promise<{ status: AvailabilityStatus; latencyMs: number | null; errorMessage: string | null }> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = net.createConnection({ host, port, timeout: timeoutMs });

    const finish = (status: AvailabilityStatus, errorMessage: string | null) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({ status, latencyMs: status === "Online" ? Date.now() - startedAt : null, errorMessage });
    };

    socket.once("connect", () => finish("Online", null));
    socket.once("timeout", () => finish("Offline", `Connection to ${host}:${port} timed out after ${timeoutMs}ms`));
    socket.once("error", (err) => finish("Offline", err.message));
  });
}

export async function testConnection(connectionId: number): Promise<{ status: AvailabilityStatus; latencyMs: number | null; errorMessage: string | null }> {
  const connection = await getConnection(connectionId);
  if (!connection) throw new Error("Connection not found");
  const host = connection.hostname || connection.ipAddress;
  if (!host) throw new Error("Connection has no hostname or IP address");

  const result = await checkTcpReachability(host, connection.port, connection.connectionTimeoutSeconds * 1000);
  await recordConnectionCheckResult(connectionId, result.status, result.latencyMs, result.errorMessage);
  return result;
}
