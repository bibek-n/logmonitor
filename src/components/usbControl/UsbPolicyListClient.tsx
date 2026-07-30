"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface PolicyRow {
  Id: number;
  Action: "Block" | "Allow";
  VendorId: string | null;
  ProductId: string | null;
  SerialNumber: string | null;
  DeviceNamePattern: string | null;
  Reason: string | null;
  CreatedAt: string;
}

interface KnownDeviceRow {
  HostName: string | null;
  Hostname: string;
  UsbName: string | null;
  VendorId: string | null;
  ProductId: string | null;
  VendorName: string | null;
  SerialNumber: string | null;
  StorageCapacityGB: number | null;
  LastSeenAt: string;
  IsConnected: number;
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

function UsbPolicyListInner({ action }: { action: "Block" | "Allow" }) {
  const toast = useToast();
  const [rows, setRows] = useState<PolicyRow[] | null>(null);
  const [knownDevices, setKnownDevices] = useState<KnownDeviceRow[]>([]);
  const [selectedDeviceKey, setSelectedDeviceKey] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [productId, setProductId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [deviceNamePattern, setDeviceNamePattern] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/usb-control/policies?action=${action}`);
    const data = await res.json();
    if (res.ok && data.ok) setRows(data.data);
  }, [action]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/admin/usb-control/known-devices")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setKnownDevices(data.data);
      });
  }, []);

  function deviceKey(d: KnownDeviceRow, i: number): string {
    return `${i}:${d.Hostname}:${d.VendorId ?? ""}:${d.ProductId ?? ""}:${d.SerialNumber ?? ""}`;
  }

  function pickKnownDevice(key: string) {
    setSelectedDeviceKey(key);
    if (!key) return;
    const [indexStr] = key.split(":");
    const d = knownDevices[Number(indexStr)];
    if (!d) return;
    setVendorId(d.VendorId ?? "");
    setProductId(d.ProductId ?? "");
    setSerialNumber(d.SerialNumber ?? "");
    setDeviceNamePattern("");
  }

  async function add() {
    if (!vendorId.trim() && !serialNumber.trim() && !deviceNamePattern.trim()) {
      toast.show({ type: "error", message: "Provide at least one of: vendor ID, serial number, or device name pattern." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/usb-control/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          vendorId: vendorId.trim(),
          productId: productId.trim(),
          serialNumber: serialNumber.trim(),
          deviceNamePattern: deviceNamePattern.trim(),
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to add entry.");
      toast.show({ type: "success", message: data.note ?? "Entry added." });
      setSelectedDeviceKey("");
      setVendorId("");
      setProductId("");
      setSerialNumber("");
      setDeviceNamePattern("");
      setReason("");
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to add entry." });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: number) {
    try {
      const res = await fetch(`/api/admin/usb-control/policies/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to remove entry.");
      setRows((r) => r?.filter((row) => row.Id !== id) ?? null);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to remove entry." });
    }
  }

  return (
    <Card>
      {action === "Block" ? (
        <div
          className="dash-panel"
          style={{ borderColor: "var(--success)", color: "var(--ink-muted)", fontSize: "0.8rem", marginBottom: "1rem" }}
        >
          Enforced on Windows endpoints: the agent applies this list on every heartbeat (~30s). A Vendor ID + Product ID
          pair blocks that exact device model even before it's plugged in; Serial Number/Device Name entries only block
          devices that are actually connected when the agent checks. Not enforced on Linux endpoints.
        </div>
      ) : (
        <div
          className="dash-panel"
          style={{ borderColor: "var(--warning)", color: "var(--ink-muted)", fontSize: "0.8rem", marginBottom: "1rem" }}
        >
          Tracked for visibility and audit only - there&apos;s no &quot;default-deny except allow-listed&quot; mode for this to
          override yet, so an Allow entry doesn&apos;t change device behavior.
        </div>
      )}

      <div className="field" style={{ marginBottom: "1rem" }}>
        <label htmlFor="knownDevice">Choose from Connected/History</label>
        <select
          id="knownDevice"
          value={selectedDeviceKey}
          onChange={(e) => pickKnownDevice(e.target.value)}
          style={{ ...inputStyle, width: "100%", maxWidth: 560 }}
        >
          <option value="">Or type the fields below manually...</option>
          {knownDevices.map((d, i) => {
            const key = deviceKey(d, i);
            const label = [
              d.IsConnected ? "🟢 Connected" : "History",
              d.VendorName ?? d.UsbName ?? "Unknown device",
              d.VendorId && `VID ${d.VendorId}`,
              d.ProductId && `PID ${d.ProductId}`,
              d.SerialNumber && `serial ${d.SerialNumber}`,
              `on ${d.HostName ?? d.Hostname}`,
              !d.IsConnected && `(${new Date(d.LastSeenAt).toLocaleDateString()})`,
            ]
              .filter(Boolean)
              .join(" - ");
            return (
              <option key={key} value={key}>
                {label}
              </option>
            );
          })}
        </select>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <div className="field" style={{ marginBottom: 0, flex: "1 1 140px" }}>
          <label htmlFor="vendorId">Vendor ID (VID)</label>
          <input id="vendorId" value={vendorId} onChange={(e) => setVendorId(e.target.value)} placeholder="e.g. 0951" style={inputStyle} />
        </div>
        <div className="field" style={{ marginBottom: 0, flex: "1 1 140px" }}>
          <label htmlFor="productId">Product ID (PID)</label>
          <input id="productId" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="e.g. 1666" style={inputStyle} />
        </div>
        <div className="field" style={{ marginBottom: 0, flex: "1 1 200px" }}>
          <label htmlFor="serialNumber">Serial Number</label>
          <input id="serialNumber" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} style={inputStyle} />
        </div>
        <div className="field" style={{ marginBottom: 0, flex: "1 1 200px" }}>
          <label htmlFor="deviceNamePattern">Device Name Contains</label>
          <input
            id="deviceNamePattern"
            value={deviceNamePattern}
            onChange={(e) => setDeviceNamePattern(e.target.value)}
            placeholder="e.g. Kingston"
            style={inputStyle}
          />
        </div>
        <div className="field" style={{ marginBottom: 0, flex: "2 1 260px" }}>
          <label htmlFor="reason">Reason</label>
          <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <Button onClick={add} disabled={submitting}>
            {submitting ? "Adding..." : `Add to ${action} List`}
          </Button>
        </div>
      </div>

      {rows === null ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No entries yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ padding: "0.4rem" }}>Vendor ID</th>
                <th style={{ padding: "0.4rem" }}>Product ID</th>
                <th style={{ padding: "0.4rem" }}>Serial Number</th>
                <th style={{ padding: "0.4rem" }}>Device Name Pattern</th>
                <th style={{ padding: "0.4rem" }}>Reason</th>
                <th style={{ padding: "0.4rem" }}>Added</th>
                <th style={{ padding: "0.4rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>{r.VendorId ?? "-"}</td>
                  <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>{r.ProductId ?? "-"}</td>
                  <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>{r.SerialNumber ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>{r.DeviceNamePattern ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>{r.Reason ?? "-"}</td>
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

export function UsbPolicyListClient(props: { action: "Block" | "Allow" }) {
  return (
    <ToastProvider>
      <UsbPolicyListInner {...props} />
    </ToastProvider>
  );
}
