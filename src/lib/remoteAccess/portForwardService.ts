import net from "net";
import type { NodeSSH } from "node-ssh";
import { getDb, sql } from "../db";
import { dialSshForConnection } from "./connectionService";

// SSH local/remote port forwarding (Phase 2) - built directly on node-ssh's forwardOut/forwardIn,
// which wrap ssh2's channel API. Dynamic (SOCKS) forwarding is NOT implemented here - a real
// SOCKS5 proxy server is a materially larger, separate undertaking (parsing the SOCKS handshake
// itself, not just tunneling one fixed destination per connection) - RemotePortForwards rows of
// ForwardType 'Dynamic' are rejected at start time with an honest "not yet supported" error
// rather than silently doing nothing.
//
// Jump hosts are already handled underneath this - dialSshForConnection (connectionService.ts)
// transparently tunnels through a connection's configured jump host before this module ever sees
// the resulting NodeSSH instance, so a port forward defined on a connection behind a bastion
// works without this file needing to know about the hop.

interface ActiveLocalForward {
  type: "Local";
  ssh: NodeSSH;
  server: net.Server;
}

interface ActiveRemoteForward {
  type: "Remote";
  ssh: NodeSSH;
  dispose: () => Promise<void>;
}

type ActiveForward = ActiveLocalForward | ActiveRemoteForward;

const activeForwards = new Map<number, ActiveForward>();

export function isPortForwardActive(portForwardId: number): boolean {
  return activeForwards.has(portForwardId);
}

async function setForwardStatus(portForwardId: number, status: "Active" | "Stopped" | "Failed", errorMessage: string | null, userId: number | null): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, portForwardId)
    .input("status", sql.VarChar, status)
    .input("errorMessage", sql.NVarChar, errorMessage)
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE RemotePortForwards SET
        Status = @status,
        ErrorMessage = @errorMessage,
        StartedAt = CASE WHEN @status = 'Active' THEN SYSUTCDATETIME() ELSE StartedAt END,
        StoppedAt = CASE WHEN @status IN ('Stopped','Failed') THEN SYSUTCDATETIME() ELSE StoppedAt END,
        StartedByUserId = CASE WHEN @status = 'Active' THEN @userId ELSE StartedByUserId END,
        UpdatedByUserId = @userId, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);
}

interface PortForwardRow {
  id: number;
  connectionId: number;
  forwardType: "Local" | "Remote" | "Dynamic";
  localPort: number;
  remoteHost: string | null;
  remotePort: number | null;
}

async function getPortForwardRow(portForwardId: number): Promise<PortForwardRow | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, portForwardId).query<{
    Id: number;
    ConnectionId: number;
    ForwardType: "Local" | "Remote" | "Dynamic";
    LocalPort: number;
    RemoteHost: string | null;
    RemotePort: number | null;
  }>("SELECT Id, ConnectionId, ForwardType, LocalPort, RemoteHost, RemotePort FROM RemotePortForwards WHERE Id = @id AND IsDeleted = 0");
  const row = result.recordset[0];
  if (!row) return null;
  return { id: row.Id, connectionId: row.ConnectionId, forwardType: row.ForwardType, localPort: row.LocalPort, remoteHost: row.RemoteHost, remotePort: row.RemotePort };
}

export async function startPortForward(portForwardId: number, userId: number): Promise<void> {
  if (activeForwards.has(portForwardId)) return; // already running - starting twice is a no-op

  const row = await getPortForwardRow(portForwardId);
  if (!row) throw new Error("Port forward not found");
  if (row.forwardType === "Dynamic") throw new Error("Dynamic (SOCKS) forwarding is not yet supported - only Local and Remote forwards can be started.");
  if (!row.remoteHost || !row.remotePort) throw new Error("This forward has no remote host/port configured.");

  const ssh = await dialSshForConnection(row.connectionId);

  try {
    if (row.forwardType === "Local") {
      const server = net.createServer((socket) => {
        ssh
          .forwardOut(socket.remoteAddress || "127.0.0.1", socket.remotePort || 0, row.remoteHost as string, row.remotePort as number)
          .then((channel) => {
            socket.pipe(channel);
            channel.pipe(socket);
            channel.on("close", () => socket.destroy());
            socket.on("close", () => channel.close());
          })
          .catch(() => socket.destroy());
      });
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(row.localPort, "127.0.0.1", () => resolve());
      });
      activeForwards.set(portForwardId, { type: "Local", ssh, server });
    } else {
      const details = await ssh.forwardIn("0.0.0.0", row.localPort, (info, accept, reject) => {
        const channel = accept();
        const target = net.createConnection({ host: row.remoteHost as string, port: row.remotePort as number }, () => {
          channel.pipe(target);
          target.pipe(channel);
        });
        target.on("error", () => reject());
        channel.on("close", () => target.destroy());
        target.on("close", () => channel.close());
      });
      activeForwards.set(portForwardId, { type: "Remote", ssh, dispose: () => details.dispose() });
    }
    await setForwardStatus(portForwardId, "Active", null, userId);
  } catch (err) {
    ssh.dispose();
    await setForwardStatus(portForwardId, "Failed", err instanceof Error ? err.message : String(err), userId);
    throw err;
  }
}

export async function stopPortForward(portForwardId: number, userId: number): Promise<void> {
  const active = activeForwards.get(portForwardId);
  if (active) {
    if (active.type === "Local") active.server.close();
    else await active.dispose();
    active.ssh.dispose();
    activeForwards.delete(portForwardId);
  }
  await setForwardStatus(portForwardId, "Stopped", null, userId);
}
