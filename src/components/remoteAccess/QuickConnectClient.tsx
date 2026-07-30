"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const inputStyle = {
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
  width: "100%",
};

function field(label: string, children: React.ReactNode) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>{label}</label>
      {children}
    </div>
  );
}

function QuickConnectInner() {
  const toast = useToast();
  const router = useRouter();
  const [sshKeys, setSshKeys] = useState<{ id: number; name: string }[]>([]);
  const [form, setForm] = useState({ hostname: "", port: 22, username: "", password: "", sshKeyId: "" as number | "", saveConnection: false });
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/remote-access/ssh-keys");
      const data = await res.json();
      if (res.ok && data.ok) setSshKeys(data.data);
    })();
  }, []);

  async function connect() {
    if (!form.hostname.trim()) {
      toast.show({ type: "error", message: "Enter a hostname or IP address." });
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch("/api/admin/remote-access/quick-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol: "SSH", hostname: form.hostname, port: form.port, username: form.username, password: form.password || undefined, sshKeyId: form.sshKeyId || undefined, saveConnection: form.saveConnection }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Connection failed.");
      router.push(`/dashboard/remote-access/terminal/${data.data.sessionId}`);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Connection failed." });
    } finally {
      setConnecting(false);
    }
  }

  function clear() {
    setForm({ hostname: "", port: 22, username: "", password: "", sshKeyId: "", saveConnection: false });
  }

  return (
    <Card>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
        For a temporary SSH session - nothing is saved unless you tick &quot;Save connection&quot; below. Other protocols arrive in Phase 2.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.7rem" }}>
        {field("Hostname or IP Address", <input value={form.hostname} onChange={(e) => setForm((f) => ({ ...f, hostname: e.target.value }))} style={inputStyle} />)}
        {field("Port", <input type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))} style={inputStyle} />)}
        {field("Username", <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} style={inputStyle} />)}
        {field("Password", <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} style={inputStyle} />)}
        {field(
          "SSH Key (instead of password)",
          <select value={form.sshKeyId} onChange={(e) => setForm((f) => ({ ...f, sshKeyId: e.target.value ? Number(e.target.value) : "" }))} style={inputStyle}>
            <option value="">None</option>
            {sshKeys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.7rem", fontSize: "0.85rem" }}>
        <input type="checkbox" checked={form.saveConnection} onChange={(e) => setForm((f) => ({ ...f, saveConnection: e.target.checked }))} />
        Save connection (never saves the password - only the connection metadata)
      </label>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem" }}>
        <Button onClick={connect} disabled={connecting}>
          Connect
        </Button>
        <Button variant="secondary" onClick={clear}>
          Clear
        </Button>
      </div>
    </Card>
  );
}

export function QuickConnectClient() {
  return (
    <ToastProvider>
      <QuickConnectInner />
    </ToastProvider>
  );
}
