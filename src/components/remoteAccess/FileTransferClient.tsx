"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface Connection {
  id: number;
  name: string;
  protocol: string;
}
interface RemoteFileEntry {
  name: string;
  isDirectory: boolean;
  sizeBytes: number;
  modifiedAt: string;
  permissions: string;
}

const inputStyle = {
  padding: "0.4rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileTransferInner() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState<number | "">("");
  const [remotePath, setRemotePath] = useState("/");
  const [entries, setEntries] = useState<RemoteFileEntry[] | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/remote-access/connections");
      const data = await res.json();
      if (res.ok && data.ok) setConnections(data.data.filter((c: Connection) => ["SSH", "SFTP", "SCP", "FTP", "FTPS"].includes(c.protocol)));
    })();
  }, []);

  const loadDirectory = useCallback(async () => {
    if (!connectionId) return;
    const res = await fetch(`/api/admin/remote-access/file-transfer/list?connectionId=${connectionId}&path=${encodeURIComponent(remotePath)}`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to list directory." });
      setEntries([]);
      return;
    }
    setEntries(data.data);
  }, [connectionId, remotePath, toast]);

  useEffect(() => {
    if (connectionId) loadDirectory();
  }, [connectionId, loadDirectory]);

  async function upload(file: File) {
    if (!connectionId) return;
    const form = new FormData();
    form.append("file", file);
    form.append("connectionId", String(connectionId));
    form.append("remoteDir", remotePath);
    const res = await fetch("/api/admin/remote-access/file-transfer/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Upload failed." });
      return;
    }
    toast.show({ type: "success", message: `Uploaded ${file.name}.` });
    await loadDirectory();
  }

  function download(entry: RemoteFileEntry) {
    if (!connectionId) return;
    const path = `${remotePath.replace(/\/+$/, "")}/${entry.name}`;
    window.open(`/api/admin/remote-access/file-transfer/download?connectionId=${connectionId}&path=${encodeURIComponent(path)}`, "_blank");
  }

  async function remove(entry: RemoteFileEntry) {
    if (!connectionId) return;
    if (!confirm(`Delete ${entry.isDirectory ? "directory" : "file"} "${entry.name}"? This cannot be undone.`)) return;
    const path = `${remotePath.replace(/\/+$/, "")}/${entry.name}`;
    const res = await fetch("/api/admin/remote-access/file-transfer/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, path, isDirectory: entry.isDirectory, confirm: true }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Delete failed." });
      return;
    }
    toast.show({ type: "success", message: `${entry.name} deleted.` });
    await loadDirectory();
  }

  function openEntry(entry: RemoteFileEntry) {
    if (entry.isDirectory) setRemotePath(`${remotePath.replace(/\/+$/, "")}/${entry.name}`);
  }

  const selectedProtocol = connections.find((c) => c.id === connectionId)?.protocol;

  return (
    <div>
      {selectedProtocol === "FTP" && (
        <Card style={{ marginBottom: "1rem", borderColor: "var(--warning)" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--warning)" }}>
            Plain FTP sends credentials and file contents unencrypted over the network. Use FTPS for an encrypted
            connection whenever the target server supports it.
          </p>
        </Card>
      )}

      <Card style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.78rem" }}>Connection</label>
            <select value={connectionId} onChange={(e) => setConnectionId(e.target.value ? Number(e.target.value) : "")} style={inputStyle}>
              <option value="">Choose a connection...</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: "block", fontSize: "0.78rem" }}>Remote Path</label>
            <input value={remotePath} onChange={(e) => setRemotePath(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadDirectory()} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <Button variant="secondary" onClick={loadDirectory} disabled={!connectionId}>
            Refresh
          </Button>
          <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button onClick={() => fileInputRef.current?.click()} disabled={!connectionId}>
            Upload
          </Button>
        </div>
      </Card>

      <div className="dash-panel">
        {!connectionId ? (
          <p style={{ color: "var(--ink-muted)" }}>Choose a connection to browse its remote filesystem.</p>
        ) : entries === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : entries.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>Empty directory.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ padding: "0.4rem" }}>Name</th>
                <th style={{ padding: "0.4rem" }}>Size</th>
                <th style={{ padding: "0.4rem" }}>Permissions</th>
                <th style={{ padding: "0.4rem" }}>Modified</th>
                <th style={{ padding: "0.4rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {entries
                .filter((e) => e.name !== "." && e.name !== "..")
                .map((entry) => (
                  <tr key={entry.name} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem", cursor: entry.isDirectory ? "pointer" : "default" }} onClick={() => openEntry(entry)}>
                      {entry.isDirectory ? "📁 " : "📄 "}
                      {entry.name}
                    </td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{entry.isDirectory ? "-" : formatSize(entry.sizeBytes)}</td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{entry.permissions}</td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{new Date(entry.modifiedAt).toLocaleString()}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      {!entry.isDirectory && (
                        <Button size="sm" variant="secondary" onClick={() => download(entry)}>
                          Download
                        </Button>
                      )}{" "}
                      <Button size="sm" variant="danger" onClick={() => remove(entry)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function FileTransferClient() {
  return (
    <ToastProvider>
      <FileTransferInner />
    </ToastProvider>
  );
}
