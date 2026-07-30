"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface Connection {
  id: number;
  name: string;
  protocol: string;
}
interface PortForward {
  id: number;
  connectionId: number;
  forwardType: "Local" | "Remote" | "Dynamic";
  localPort: number;
  remoteHost: string | null;
  remotePort: number | null;
  status: "Active" | "Stopped" | "Failed";
  errorMessage: string | null;
}

const inputStyle = { padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem" };
const STATUS_TONE: Record<string, "success" | "danger" | "neutral"> = { Active: "success", Failed: "danger", Stopped: "neutral" };

function PortForwardingInner() {
  const toast = useToast();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [forwards, setForwards] = useState<PortForward[] | null>(null);
  const [form, setForm] = useState({ connectionId: "", forwardType: "Local" as PortForward["forwardType"], localPort: "", remoteHost: "", remotePort: "" });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/remote-access/port-forwards");
    const data = await res.json();
    if (res.ok && data.ok) setForwards(data.data);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/remote-access/connections");
      const data = await res.json();
      if (res.ok && data.ok) setConnections(data.data.filter((c: Connection) => c.protocol === "SSH"));
    })();
    load();
  }, [load]);

  async function create() {
    if (!form.connectionId || !form.localPort) {
      toast.show({ type: "error", message: "Connection and local port are required." });
      return;
    }
    if (form.forwardType !== "Dynamic" && (!form.remoteHost || !form.remotePort)) {
      toast.show({ type: "error", message: "Local/Remote forwards need a remote host and port." });
      return;
    }
    const res = await fetch("/api/admin/remote-access/port-forwards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId: Number(form.connectionId),
        forwardType: form.forwardType,
        localPort: Number(form.localPort),
        remoteHost: form.remoteHost || null,
        remotePort: form.remotePort ? Number(form.remotePort) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to create port forward." });
      return;
    }
    setForm({ connectionId: "", forwardType: "Local", localPort: "", remoteHost: "", remotePort: "" });
    await load();
  }

  async function start(fw: PortForward) {
    if (fw.forwardType === "Dynamic") {
      toast.show({ type: "error", message: "Dynamic (SOCKS) forwarding is not yet supported." });
      return;
    }
    const res = await fetch(`/api/admin/remote-access/port-forwards/${fw.id}/start`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to start forward." });
      return;
    }
    toast.show({ type: "success", message: "Port forward started." });
    await load();
  }

  async function stop(fw: PortForward) {
    await fetch(`/api/admin/remote-access/port-forwards/${fw.id}/stop`, { method: "POST" });
    await load();
  }

  async function remove(fw: PortForward) {
    if (!confirm(`Remove this port forward (local :${fw.localPort})?`)) return;
    await fetch(`/api/admin/remote-access/port-forwards/${fw.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>New Port Forward</h3>
        <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginTop: -6 }}>
          Local and Remote forwards tunnel through the selected connection&apos;s SSH session (including any
          configured jump host). Dynamic (SOCKS) forwarding is not yet supported.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.78rem" }}>Connection</label>
            <select value={form.connectionId} onChange={(e) => setForm({ ...form, connectionId: e.target.value })} style={inputStyle}>
              <option value="">Choose an SSH connection...</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.78rem" }}>Type</label>
            <select value={form.forwardType} onChange={(e) => setForm({ ...form, forwardType: e.target.value as PortForward["forwardType"] })} style={inputStyle}>
              <option value="Local">Local</option>
              <option value="Remote">Remote</option>
              <option value="Dynamic">Dynamic (SOCKS)</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.78rem" }}>Local Port</label>
            <input value={form.localPort} onChange={(e) => setForm({ ...form, localPort: e.target.value })} style={{ ...inputStyle, width: 90 }} />
          </div>
          {form.forwardType !== "Dynamic" && (
            <>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem" }}>Remote Host</label>
                <input value={form.remoteHost} onChange={(e) => setForm({ ...form, remoteHost: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem" }}>Remote Port</label>
                <input value={form.remotePort} onChange={(e) => setForm({ ...form, remotePort: e.target.value })} style={{ ...inputStyle, width: 90 }} />
              </div>
            </>
          )}
          <Button onClick={create}>Add</Button>
        </div>
      </Card>

      <div className="dash-panel">
        {forwards === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : forwards.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No port forwards configured yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ padding: "0.4rem" }}>Type</th>
                <th style={{ padding: "0.4rem" }}>Local Port</th>
                <th style={{ padding: "0.4rem" }}>Remote Target</th>
                <th style={{ padding: "0.4rem" }}>Status</th>
                <th style={{ padding: "0.4rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {forwards.map((fw) => (
                <tr key={fw.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{fw.forwardType}</td>
                  <td style={{ padding: "0.4rem" }}>{fw.localPort}</td>
                  <td style={{ padding: "0.4rem" }}>{fw.remoteHost ? `${fw.remoteHost}:${fw.remotePort}` : "-"}</td>
                  <td style={{ padding: "0.4rem" }}>
                    <Badge tone={STATUS_TONE[fw.status]}>{fw.status}</Badge>
                    {fw.errorMessage && <span style={{ marginLeft: 6, fontSize: "0.75rem", color: "var(--ink-muted)" }}>{fw.errorMessage}</span>}
                  </td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                    {fw.status === "Active" ? (
                      <Button size="sm" variant="secondary" onClick={() => stop(fw)}>
                        Stop
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => start(fw)}>
                        Start
                      </Button>
                    )}{" "}
                    <Button size="sm" variant="danger" onClick={() => remove(fw)}>
                      Remove
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

export function PortForwardingClient() {
  return (
    <ToastProvider>
      <PortForwardingInner />
    </ToastProvider>
  );
}
