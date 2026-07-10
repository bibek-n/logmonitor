"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.65rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};
const labelStyle: React.CSSProperties = { fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" };

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "0.75rem",
        fontSize: "0.78rem",
        overflowX: "auto",
        margin: 0,
        whiteSpace: "pre-wrap",
      }}
    >
      {children}
    </pre>
  );
}

export function AddServerForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    deviceName: "",
    hostname: "",
    ipAddress: "",
    serverRole: "",
    operatingSystem: "linux",
    status: "Pending",
    macAddress: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ deviceId: string; token: string; expiresAt: string } | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.deviceName.trim()) {
      setError("Device Name is required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create server");
      setResult({ deviceId: data.deviceId, token: data.token, expiresAt: data.expiresAt });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const serverUrl = typeof window !== "undefined" ? window.location.origin : "https://logs.tulipshrm.com:4433";

  if (result) {
    return (
      <Card className="flex flex-col gap-3">
        <h2 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>Server registered — install the agent</h2>
        <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)", margin: 0 }}>
          Enrollment token (expires {new Date(result.expiresAt).toLocaleString()}). Run the matching command on the server —
          it will connect automatically and start discovering hardware and shipping logs.
        </p>

        {form.operatingSystem === "windows" ? (
          <>
            <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>Windows install</div>
            <CodeBlock>{`Download the latest agent.exe from https://github.com/bibek-n/logmonitor/releases\nand run as administrator:\n\nagent.exe install --token=${result.token} --server=${serverUrl}`}</CodeBlock>
          </>
        ) : (
          <>
            <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>Linux install</div>
            <CodeBlock>{`curl -fsSL https://raw.githubusercontent.com/bibek-n/logmonitor/main/install.sh | sudo TOKEN=${result.token} SERVER_URL=${serverUrl} bash`}</CodeBlock>
          </>
        )}

        <div className="flex gap-2">
          <Button size="sm" onClick={() => router.push(`/dashboard/servers/${result.deviceId}`)}>
            View server
          </Button>
          <Button size="sm" variant="secondary" onClick={() => router.push("/dashboard/servers")}>
            Back to server list
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="flex flex-col gap-4">
        {error && <div style={{ color: "var(--danger)", fontSize: "0.82rem" }}>{error}</div>}

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div>
            <label style={labelStyle}>Device Name *</label>
            <input style={fieldStyle} value={form.deviceName} onChange={(e) => set("deviceName", e.target.value)} placeholder="Prod Web Server 1" />
          </div>
          <div>
            <label style={labelStyle}>Hostname</label>
            <input style={fieldStyle} value={form.hostname} onChange={(e) => set("hostname", e.target.value)} placeholder="Auto-filled once the agent connects" />
          </div>
          <div>
            <label style={labelStyle}>IP Address</label>
            <input style={fieldStyle} value={form.ipAddress} onChange={(e) => set("ipAddress", e.target.value)} placeholder="10.0.0.10" />
          </div>
          <div>
            <label style={labelStyle}>Device Type</label>
            <input style={{ ...fieldStyle, opacity: 0.7 }} value="Server" disabled />
          </div>
          <div>
            <label style={labelStyle}>Server Role</label>
            <input style={fieldStyle} value={form.serverRole} onChange={(e) => set("serverRole", e.target.value)} placeholder="Web Server, Database Server, ..." />
          </div>
          <div>
            <label style={labelStyle}>Operating System *</label>
            <Select
              value={form.operatingSystem}
              onChange={(v) => set("operatingSystem", v)}
              options={[
                { label: "Linux", value: "linux" },
                { label: "Windows", value: "windows" },
              ]}
            />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <Select
              value={form.status}
              onChange={(v) => set("status", v)}
              options={[
                { label: "Pending", value: "Pending" },
                { label: "Active", value: "Active" },
                { label: "Maintenance", value: "Maintenance" },
                { label: "Decommissioned", value: "Decommissioned" },
              ]}
            />
          </div>
          <div>
            <label style={labelStyle}>MAC Address</label>
            <input style={fieldStyle} value={form.macAddress} onChange={(e) => set("macAddress", e.target.value)} placeholder="00:1A:2B:3C:4D:5E" />
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save and Get Install Command"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
