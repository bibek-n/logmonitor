import { Client } from "basic-ftp";
import { getConnection, getCredentialSecret } from "./repository";
import type { RemoteFileEntry } from "./connectionService";

// Real FTP/FTPS file-transfer support (Phase 2) - a genuinely buildable protocol, unlike RDP/VNC
// (which need a protocol gateway this stack doesn't have) or WinRM (no maintained Node client
// library exists). basic-ftp is a pure-JS FTP/FTPS client with no native bindings.
//
// A plain-FTP security warning is shown client-side (FileTransferClient.tsx) before this ever
// dials - unencrypted credentials/data in transit is an inherent property of the FTP protocol
// itself, not something this module can fix; FTPS (secure: true) is the encrypted alternative.
async function withFtp<T>(connectionId: number, fn: (client: Client) => Promise<T>): Promise<T> {
  const connection = await getConnection(connectionId);
  if (!connection) throw new Error("Connection not found");
  const host = connection.hostname || connection.ipAddress;
  if (!host) throw new Error("Connection has no hostname or IP address");

  let password: string | undefined;
  if (connection.credentialId) {
    const cred = await getCredentialSecret(connection.credentialId);
    if (cred) password = cred.secret;
  }

  const client = new Client(connection.connectionTimeoutSeconds * 1000);
  try {
    await client.access({
      host,
      port: connection.port,
      user: connection.username || "anonymous",
      password: password ?? "guest",
      secure: connection.protocol === "FTPS",
    });
    return await fn(client);
  } finally {
    client.close();
  }
}

export async function listFtpDirectory(connectionId: number, remotePath: string): Promise<RemoteFileEntry[]> {
  return withFtp(connectionId, async (client) => {
    const list = await client.list(remotePath || "/");
    return list.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory,
      sizeBytes: entry.size,
      modifiedAt: entry.modifiedAt ?? new Date(0),
      permissions: entry.permissions ? `${entry.permissions.user}${entry.permissions.group}${entry.permissions.world}` : "",
    }));
  });
}

export async function uploadFileViaFtp(connectionId: number, localPath: string, remotePath: string): Promise<void> {
  await withFtp(connectionId, (client) => client.uploadFrom(localPath, remotePath));
}

export async function downloadFileViaFtp(connectionId: number, remotePath: string, localPath: string): Promise<void> {
  await withFtp(connectionId, (client) => client.downloadTo(localPath, remotePath));
}

export async function deleteFtpEntry(connectionId: number, remotePath: string, isDirectory: boolean): Promise<void> {
  await withFtp(connectionId, async (client) => {
    if (isDirectory) await client.removeDir(remotePath);
    else await client.remove(remotePath);
  });
}

export async function mkdirFtp(connectionId: number, remotePath: string): Promise<void> {
  await withFtp(connectionId, (client) => client.ensureDir(remotePath));
}
