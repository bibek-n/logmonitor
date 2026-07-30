"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface Device {
  id: number;
  deviceName: string;
  hostname: string | null;
  ipAddress: string | null;
  operatingSystem: string | null;
  deviceTypeCategory: string | null;
  environment: string | null;
  customer: string | null;
  availabilityStatus: string;
  linkedConnectionId: number | null;
}

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = { Online: "success", Offline: "danger", Degraded: "warning", Unknown: "neutral" };
const inputStyle = { padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem" };

function InventoryInner() {
  const toast = useToast();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [name, setName] = useState("");
  const [os, setOs] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/remote-access/inventory");
    const data = await res.json();
    if (res.ok && data.ok) setDevices(data.data);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!name.trim()) {
      toast.show({ type: "error", message: "Device name is required." });
      return;
    }
    const res = await fetch("/api/admin/remote-access/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceName: name, operatingSystem: os || null, tags: [] }) });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to add device." });
      return;
    }
    setName("");
    setOs("");
    await load();
  }

  async function ping(device: Device) {
    const res = await fetch(`/api/admin/remote-access/inventory/${device.id}/ping`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Ping failed." });
      return;
    }
    toast.show({ type: data.data.status === "Online" ? "success" : "error", message: `Status: ${data.data.status}` });
  }

  async function restart(device: Device) {
    if (!confirm(`Restart "${device.deviceName}"? This will disconnect any active sessions on it.`)) return;
    const res = await fetch(`/api/admin/remote-access/inventory/${device.id}/restart`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Restart failed." });
      return;
    }
    toast.show({ type: "success", message: "Restart command sent." });
  }

  async function shutdown(device: Device) {
    if (!confirm(`Shut down "${device.deviceName}"? It will need to be powered back on manually.`)) return;
    const res = await fetch(`/api/admin/remote-access/inventory/${device.id}/shutdown`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Shutdown failed." });
      return;
    }
    toast.show({ type: "success", message: "Shutdown command sent." });
  }

  async function remove(device: Device) {
    if (!confirm(`Remove "${device.deviceName}" from inventory?`)) return;
    await fetch(`/api/admin/remote-access/inventory/${device.id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Add Device</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.78rem" }}>Device Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.78rem" }}>OS</label>
            <select value={os} onChange={(e) => setOs(e.target.value)} style={inputStyle}>
              <option value="">Unspecified</option>
              <option value="linux">Linux</option>
              <option value="windows">Windows</option>
            </select>
          </div>
          <Button onClick={create}>Add Device</Button>
        </div>
      </Card>

      <div className="dash-panel">
        {devices === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : devices.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No inventory devices yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ padding: "0.4rem" }}>Device</th>
                <th style={{ padding: "0.4rem" }}>OS</th>
                <th style={{ padding: "0.4rem" }}>Status</th>
                <th style={{ padding: "0.4rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{d.deviceName}</td>
                  <td style={{ padding: "0.4rem" }}>{d.operatingSystem ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>
                    <Badge tone={STATUS_TONE[d.availabilityStatus] ?? "neutral"}>{d.availabilityStatus}</Badge>
                  </td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: "0.3rem" }}>
                      <Button size="sm" variant="secondary" onClick={() => ping(d)}>
                        Ping
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => restart(d)} disabled={!d.linkedConnectionId}>
                        Restart
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => shutdown(d)} disabled={!d.linkedConnectionId}>
                        Shut Down
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => remove(d)}>
                        Remove
                      </Button>
                    </div>
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

export function InventoryClient() {
  return (
    <ToastProvider>
      <InventoryInner />
    </ToastProvider>
  );
}
