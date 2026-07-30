"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface Device {
  DeviceId: string;
  DeviceName: string | null;
  Hostname: string;
}

interface WatchedFileRow {
  Id: number;
  DeviceId: string;
  DeviceName: string | null;
  Hostname: string;
  FilePath: string;
  Enabled: boolean;
  CreatedAt: string;
}

const inputStyle = {
  width: "100%",
  padding: "0.55rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function WatchedFilesInner({ devices }: { devices: Device[] }) {
  const toast = useToast();
  const [rows, setRows] = useState<WatchedFileRow[] | null>(null);
  const [deviceId, setDeviceId] = useState(devices[0]?.DeviceId ?? "");
  const [filePath, setFilePath] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/file-integrity/watched-files");
    const data = await res.json();
    if (res.ok && data.ok) setRows(data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!deviceId || !filePath.trim()) {
      toast.show({ type: "error", message: "Choose a device and enter a file path." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/file-integrity/watched-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, filePath: filePath.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to add watched file.");
      toast.show({ type: "success", message: data.note ?? "Watched file added." });
      setFilePath("");
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to add watched file." });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: number) {
    try {
      const res = await fetch(`/api/admin/file-integrity/watched-files/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to remove watched file.");
      setRows((r) => r?.filter((row) => row.Id !== id) ?? null);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to remove watched file." });
    }
  }

  return (
    <Card>
      <div
        className="dash-panel"
        style={{ borderColor: "var(--warning)", color: "var(--ink-muted)", fontSize: "0.8rem", marginBottom: "1rem" }}
      >
        &quot;Who modified&quot; on the Change History page is best-effort - the device&apos;s currently logged-in user at
        the moment the change was detected, not a definitive audit trail. True forensic attribution needs OS-level file
        auditing (Windows Object Access auditing / Linux auditd), which isn&apos;t configured by this feature.
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <div className="field" style={{ marginBottom: 0, flex: "1 1 260px" }}>
          <label htmlFor="device">Device</label>
          <select id="device" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} style={inputStyle}>
            {devices.map((d) => (
              <option key={d.DeviceId} value={d.DeviceId}>
                {d.DeviceName ?? d.Hostname}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, flex: "2 1 320px" }}>
          <label htmlFor="filePath">File Path</label>
          <input
            id="filePath"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder={"e.g. C:\\inetpub\\wwwroot\\web.config or /etc/nginx/nginx.conf"}
            style={inputStyle}
          />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <Button onClick={add} disabled={submitting || devices.length === 0}>
            {submitting ? "Adding..." : "Watch File"}
          </Button>
        </div>
      </div>

      {rows === null ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No watched files yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ padding: "0.4rem" }}>Device</th>
                <th style={{ padding: "0.4rem" }}>File Path</th>
                <th style={{ padding: "0.4rem" }}>Added</th>
                <th style={{ padding: "0.4rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{r.DeviceName ?? r.Hostname}</td>
                  <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>{r.FilePath}</td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(r.CreatedAt).toLocaleString()}</td>
                  <td style={{ padding: "0.4rem" }}>
                    <button
                      onClick={() => remove(r.Id)}
                      style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function WatchedFilesClient(props: { devices: Device[] }) {
  return (
    <ToastProvider>
      <WatchedFilesInner {...props} />
    </ToastProvider>
  );
}
