"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.83rem",
};
const labelStyle: React.CSSProperties = { fontSize: "0.75rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.25rem" };

export interface EditableServer {
  DeviceId: string;
  DeviceName: string | null;
  ServerRole: string | null;
  StaticIpAddress: string | null;
  MacAddress: string | null;
  LifecycleStatus: string;
}

export function EditServerModal({ server, onClose }: { server: EditableServer; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    deviceName: server.DeviceName ?? "",
    serverRole: server.ServerRole ?? "",
    ipAddress: server.StaticIpAddress ?? "",
    macAddress: server.MacAddress ?? "",
    status: server.LifecycleStatus,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.deviceName.trim()) {
      toast.show({ type: "error", message: "Device Name is required." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/servers/${server.DeviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save");
      toast.show({ type: "success", message: "Server updated." });
      router.refresh();
      onClose();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Server"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label style={labelStyle}>Device Name</label>
          <input style={fieldStyle} value={form.deviceName} onChange={(e) => setForm((f) => ({ ...f, deviceName: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>Server Role</label>
          <input style={fieldStyle} value={form.serverRole} onChange={(e) => setForm((f) => ({ ...f, serverRole: e.target.value }))} placeholder="Web Server, Database Server, ..." />
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={labelStyle}>IP Address</label>
            <input style={fieldStyle} value={form.ipAddress} onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>MAC Address</label>
            <input style={fieldStyle} value={form.macAddress} onChange={(e) => setForm((f) => ({ ...f, macAddress: e.target.value }))} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <Select
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
            options={[
              { label: "Pending", value: "Pending" },
              { label: "Active", value: "Active" },
              { label: "Maintenance", value: "Maintenance" },
              { label: "Decommissioned", value: "Decommissioned" },
            ]}
          />
        </div>
      </div>
    </Modal>
  );
}
