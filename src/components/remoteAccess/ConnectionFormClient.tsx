"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const PROTOCOLS = ["SSH", "RDP", "SFTP", "SCP", "FTP", "FTPS", "VNC", "Telnet", "WinRM", "WebAdmin", "SerialConsole"];
const ENVIRONMENTS = ["Production", "Staging", "Development", "Testing", "DisasterRecovery", "Local", "Custom"];
const DEFAULT_PORTS: Record<string, number> = { SSH: 22, RDP: 3389, SFTP: 22, SCP: 22, FTP: 21, FTPS: 990, VNC: 5900, Telnet: 23, WinRM: 5985, WebAdmin: 443, SerialConsole: 0 };

interface CredentialOption {
  id: number;
  name: string;
}
interface SshKeyOption {
  id: number;
  name: string;
}

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

export function ConnectionFormClient({ connectionId }: { connectionId?: number }) {
  return (
    <ToastProvider>
      <ConnectionFormInner connectionId={connectionId} />
    </ToastProvider>
  );
}

function ConnectionFormInner({ connectionId }: { connectionId?: number }) {
  const toast = useToast();
  const router = useRouter();
  const [credentials, setCredentials] = useState<CredentialOption[]>([]);
  const [sshKeys, setSshKeys] = useState<SshKeyOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    protocol: "SSH",
    hostname: "",
    ipAddress: "",
    port: 22,
    username: "",
    domain: "",
    credentialId: "" as number | "",
    sshKeyId: "" as number | "",
    remoteDirectory: "",
    operatingSystem: "",
    environment: "Production",
    customer: "",
    location: "",
    tags: "",
    notes: "",
    isShared: true,
  });

  useEffect(() => {
    (async () => {
      const [credRes, keyRes] = await Promise.all([fetch("/api/admin/remote-access/credentials"), fetch("/api/admin/remote-access/ssh-keys")]);
      const credData = await credRes.json();
      const keyData = await keyRes.json();
      if (credRes.ok && credData.ok) setCredentials(credData.data);
      if (keyRes.ok && keyData.ok) setSshKeys(keyData.data);

      if (connectionId) {
        const res = await fetch(`/api/admin/remote-access/connections/${connectionId}`);
        const data = await res.json();
        if (res.ok && data.ok) {
          const c = data.data;
          setForm({
            name: c.name,
            protocol: c.protocol,
            hostname: c.hostname ?? "",
            ipAddress: c.ipAddress ?? "",
            port: c.port,
            username: c.username ?? "",
            domain: c.domain ?? "",
            credentialId: c.credentialId ?? "",
            sshKeyId: c.sshKeyId ?? "",
            remoteDirectory: c.remoteDirectory ?? "",
            operatingSystem: c.operatingSystem ?? "",
            environment: c.environment,
            customer: c.customer ?? "",
            location: c.location ?? "",
            tags: (c.tags ?? []).join(", "),
            notes: c.notes ?? "",
            isShared: c.isShared ?? true,
          });
        }
      }
    })();
  }, [connectionId]);

  const buildPayload = useCallback(
    () => ({
      name: form.name,
      protocol: form.protocol,
      hostname: form.hostname || null,
      ipAddress: form.ipAddress || null,
      port: form.port,
      username: form.username || null,
      domain: form.domain || null,
      credentialId: form.credentialId || null,
      sshKeyId: form.sshKeyId || null,
      remoteDirectory: form.remoteDirectory || null,
      operatingSystem: form.operatingSystem || null,
      environment: form.environment,
      customer: form.customer || null,
      location: form.location || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: form.notes || null,
      isShared: form.isShared,
    }),
    [form]
  );

  async function save(andConnect: boolean) {
    if (!form.name.trim() || (!form.hostname.trim() && !form.ipAddress.trim())) {
      toast.show({ type: "error", message: "Name and a hostname or IP address are required." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(connectionId ? `/api/admin/remote-access/connections/${connectionId}` : "/api/admin/remote-access/connections", {
        method: connectionId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save connection.");

      toast.show({ type: "success", message: "Connection saved." });
      const savedId = connectionId ?? data.data.id;

      if (andConnect && form.protocol === "SSH") {
        const sessionRes = await fetch("/api/admin/remote-access/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: savedId }) });
        const sessionData = await sessionRes.json();
        if (sessionRes.ok && sessionData.ok) {
          router.push(`/dashboard/remote-access/terminal/${sessionData.data.sessionId}`);
          return;
        }
      }
      router.push("/dashboard/remote-access/connections");
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save connection." });
    } finally {
      setSubmitting(false);
    }
  }

  async function testBeforeSave() {
    if (!form.hostname.trim() && !form.ipAddress.trim()) {
      toast.show({ type: "error", message: "Enter a hostname or IP address first." });
      return;
    }
    toast.show({ type: "success", message: `Would test ${form.hostname || form.ipAddress}:${form.port} - save the connection first to run a real test.` });
  }

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Common</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.7rem" }}>
          {field("Connection Name *", <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />)}
          {field(
            "Protocol",
            <select
              value={form.protocol}
              onChange={(e) => setForm((f) => ({ ...f, protocol: e.target.value, port: DEFAULT_PORTS[e.target.value] || f.port }))}
              style={inputStyle}
            >
              {PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          {field("Hostname", <input value={form.hostname} onChange={(e) => setForm((f) => ({ ...f, hostname: e.target.value }))} style={inputStyle} />)}
          {field("IP Address", <input value={form.ipAddress} onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))} style={inputStyle} />)}
          {field("Port", <input type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))} style={inputStyle} />)}
          {field("Username", <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} style={inputStyle} />)}
          {field(
            "Environment",
            <select value={form.environment} onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))} style={inputStyle}>
              {ENVIRONMENTS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          )}
          {field("Tags (comma-separated)", <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} style={inputStyle} />)}
        </div>
      </Card>

      {form.protocol === "SSH" && (
        <Card style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0, fontSize: "1rem" }}>SSH</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.7rem" }}>
            {field(
              "Password Credential (from Vault)",
              <select value={form.credentialId} onChange={(e) => setForm((f) => ({ ...f, credentialId: e.target.value ? Number(e.target.value) : "" }))} style={inputStyle}>
                <option value="">None</option>
                {credentials.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {field(
              "SSH Key",
              <select value={form.sshKeyId} onChange={(e) => setForm((f) => ({ ...f, sshKeyId: e.target.value ? Number(e.target.value) : "" }))} style={inputStyle}>
                <option value="">None</option>
                {sshKeys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            )}
            {field("Remote Directory", <input value={form.remoteDirectory} onChange={(e) => setForm((f) => ({ ...f, remoteDirectory: e.target.value }))} style={inputStyle} />)}
            {field(
              "Operating System",
              <select value={form.operatingSystem} onChange={(e) => setForm((f) => ({ ...f, operatingSystem: e.target.value }))} style={inputStyle}>
                <option value="">Unspecified</option>
                <option value="linux">Linux</option>
                <option value="windows">Windows</option>
              </select>
            )}
          </div>
          <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: "0.5rem", marginBottom: 0 }}>
            Choose either a Vault credential (password) or an SSH Key - a key takes precedence if both are set.
          </p>
        </Card>
      )}

      {form.protocol === "RDP" && (
        <Card style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0, fontSize: "1rem" }}>RDP</h3>
          {field("Windows Domain", <input value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} style={inputStyle} />)}
          <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem", marginTop: "0.5rem" }}>
            In-browser RDP rendering is a Phase 2 item requiring a dedicated protocol gateway (see Remote Desktop page) - this saves connection
            metadata now.
          </p>
        </Card>
      )}

      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Details</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.7rem" }}>
          {field("Customer", <input value={form.customer} onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))} style={inputStyle} />)}
          {field("Location", <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} style={inputStyle} />)}
        </div>
        <div style={{ marginTop: "0.7rem" }}>{field("Notes", <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 70 }} />)}</div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.8rem", fontSize: "0.85rem" }}>
          <input type="checkbox" checked={form.isShared} onChange={(e) => setForm((f) => ({ ...f, isShared: e.target.checked }))} />
          Shared (visible to every user with Remote Access — uncheck to make this connection private to you)
        </label>
      </Card>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button variant="secondary" onClick={testBeforeSave}>
          Test Connection
        </Button>
        <Button onClick={() => save(false)} disabled={submitting}>
          Save
        </Button>
        {form.protocol === "SSH" && (
          <Button onClick={() => save(true)} disabled={submitting}>
            Save and Connect
          </Button>
        )}
        <Button variant="ghost" onClick={() => router.push("/dashboard/remote-access/connections")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
