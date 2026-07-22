"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

interface LatestMetrics {
  CpuPct: number | null;
  MemoryUsedMB: number | null;
  PageLifeExpectancy: number | null;
  ActiveSessionCount: number | null;
  IsAvailable: boolean;
}

interface InstanceRow {
  Id: number;
  Name: string;
  HostName: string;
  Port: number;
  AuthType: string;
  IsSelfMonitoring: boolean;
  Engine: string;
  Enabled: boolean;
  LastCheckAt: string | null;
  LastCheckStatus: string | null;
  LastErrorMessage: string | null;
  HasSshBackupCheck: boolean;
  latestMetrics: LatestMetrics | null;
}

const inputStyle = { padding: "0.4rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)", fontSize: "0.82rem", width: "100%" };
const fieldWrapStyle = { flex: "1 1 160px" };

const ENGINE_LABELS: Record<string, string> = { mssql: "SQL Server", mysql: "MySQL", postgres: "PostgreSQL" };
const DEFAULT_PORT_BY_ENGINE: Record<string, string> = { mssql: "1433", mysql: "3306", postgres: "5432" };

function statusTone(instance: InstanceRow): "success" | "warning" | "danger" | "neutral" {
  if (!instance.Enabled) return "neutral";
  if (!instance.LastCheckStatus) return "neutral";
  if (instance.LastCheckStatus === "Failed") return "danger";
  if (instance.latestMetrics && !instance.latestMetrics.IsAvailable) return "danger";
  return "success";
}

export function InstancesListClient({ initialInstances }: { initialInstances: InstanceRow[] }) {
  const [instances, setInstances] = useState(initialInstances);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [engine, setEngine] = useState<"mssql" | "mysql" | "postgres">("mssql");
  const [hostName, setHostName] = useState("");
  const [port, setPort] = useState("1433");
  const [portTouched, setPortTouched] = useState(false);
  const [authType, setAuthType] = useState<"sql" | "windows">("sql");
  const [sqlUsername, setSqlUsername] = useState("");
  const [sqlPassword, setSqlPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Optional per-instance SSH-based backup-status check (see backupStatusSsh.ts) - only
  // offered for engines with no built-in backup catalog (MySQL/PostgreSQL; MSSQL already gets
  // this from msdb natively). One inline form open at a time, keyed by instance id.
  const [sshFormInstanceId, setSshFormInstanceId] = useState<number | null>(null);
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [sshUsername, setSshUsername] = useState("");
  const [sshPassword, setSshPassword] = useState("");
  const [backupBaseDir, setBackupBaseDir] = useState("");
  const [sshError, setSshError] = useState<string | null>(null);
  const [sshSubmitting, setSshSubmitting] = useState(false);

  async function refresh() {
    const res = await fetch("/api/admin/sqlserver-monitoring/instances");
    const data = await res.json();
    if (data.ok) {
      setInstances((prev) =>
        data.data.map((i: InstanceRow) => ({ ...i, latestMetrics: prev.find((p) => p.Id === i.Id)?.latestMetrics ?? null }))
      );
    }
  }

  async function addInstance(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/admin/sqlserver-monitoring/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        engine,
        hostName: hostName.trim(),
        port: Number(port) || Number(DEFAULT_PORT_BY_ENGINE[engine]),
        authType: engine === "mssql" ? authType : "sql",
        sqlUsername: sqlUsername.trim(),
        sqlPassword,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Failed to add instance.");
      return;
    }
    setName("");
    setEngine("mssql");
    setHostName("");
    setPort(DEFAULT_PORT_BY_ENGINE.mssql);
    setPortTouched(false);
    setSqlUsername("");
    setSqlPassword("");
    setShowAddForm(false);
    refresh();
  }

  function changeEngine(next: "mssql" | "mysql" | "postgres") {
    setEngine(next);
    if (!portTouched) setPort(DEFAULT_PORT_BY_ENGINE[next]);
  }

  async function toggleEnabled(instance: InstanceRow) {
    await fetch(`/api/admin/sqlserver-monitoring/instances/${instance.Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !instance.Enabled }),
    });
    refresh();
  }

  async function remove(instance: InstanceRow) {
    await fetch(`/api/admin/sqlserver-monitoring/instances/${instance.Id}`, { method: "DELETE" });
    refresh();
  }

  function openSshForm(instance: InstanceRow) {
    setSshFormInstanceId(instance.Id);
    setSshHost("");
    setSshPort("22");
    setSshUsername("");
    setSshPassword("");
    setBackupBaseDir("");
    setSshError(null);
  }

  async function saveSshConfig(e: React.FormEvent, instanceId: number) {
    e.preventDefault();
    setSshError(null);
    setSshSubmitting(true);
    const res = await fetch(`/api/admin/sqlserver-monitoring/instances/${instanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sshHost: sshHost.trim(),
        sshPort: Number(sshPort) || 22,
        sshUsername: sshUsername.trim(),
        sshPassword,
        backupBaseDir: backupBaseDir.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSshSubmitting(false);
    if (!res.ok || !data.ok) {
      setSshError(data.error ?? "Failed to save SSH backup check.");
      return;
    }
    setSshFormInstanceId(null);
    refresh();
  }

  async function clearSshConfig(instanceId: number) {
    if (!confirm("Remove the SSH backup check for this instance?")) return;
    await fetch(`/api/admin/sqlserver-monitoring/instances/${instanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sshHost: null }),
    });
    refresh();
  }

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className="submit"
          onClick={() => setShowAddForm((v) => !v)}
          style={{ width: "auto", marginTop: 0, padding: "0.4rem 1rem" }}
        >
          {showAddForm ? "Cancel" : "+ Add Remote Instance"}
        </button>
      </div>

      {showAddForm && (
        <Card style={{ marginBottom: "1rem" }}>
          <form onSubmit={addInstance} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={fieldWrapStyle}>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-muted)", marginBottom: "0.2rem" }}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} placeholder="e.g. Reporting SQL Server" />
            </div>
            <div style={fieldWrapStyle}>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-muted)", marginBottom: "0.2rem" }}>Engine</label>
              <select value={engine} onChange={(e) => changeEngine(e.target.value as "mssql" | "mysql" | "postgres")} style={inputStyle}>
                <option value="mssql">SQL Server</option>
                <option value="mysql">MySQL</option>
                <option value="postgres">PostgreSQL</option>
              </select>
            </div>
            <div style={fieldWrapStyle}>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-muted)", marginBottom: "0.2rem" }}>Host</label>
              <input value={hostName} onChange={(e) => setHostName(e.target.value)} required style={inputStyle} placeholder="hostname or IP" />
            </div>
            <div style={{ flex: "1 1 100px" }}>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-muted)", marginBottom: "0.2rem" }}>Port</label>
              <input
                value={port}
                onChange={(e) => {
                  setPort(e.target.value);
                  setPortTouched(true);
                }}
                style={inputStyle}
                placeholder={DEFAULT_PORT_BY_ENGINE[engine]}
              />
            </div>
            {engine === "mssql" && (
              <div style={fieldWrapStyle}>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-muted)", marginBottom: "0.2rem" }}>Auth Type</label>
                <select value={authType} onChange={(e) => setAuthType(e.target.value as "sql" | "windows")} style={inputStyle}>
                  <option value="sql">SQL Login</option>
                  <option value="windows">Windows Auth</option>
                </select>
              </div>
            )}
            {(engine !== "mssql" || authType === "sql") && (
              <>
                <div style={fieldWrapStyle}>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-muted)", marginBottom: "0.2rem" }}>
                    {engine === "mssql" ? "SQL Username" : "Username"}
                  </label>
                  <input value={sqlUsername} onChange={(e) => setSqlUsername(e.target.value)} style={inputStyle} />
                </div>
                <div style={fieldWrapStyle}>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-muted)", marginBottom: "0.2rem" }}>
                    {engine === "mssql" ? "SQL Password" : "Password"}
                  </label>
                  <input type="password" value={sqlPassword} onChange={(e) => setSqlPassword(e.target.value)} style={inputStyle} />
                </div>
              </>
            )}
            <button type="submit" className="submit" disabled={submitting} style={{ width: "auto", marginTop: 0, padding: "0.4rem 1rem" }}>
              {submitting ? "Adding..." : "Add"}
            </button>
          </form>
          <p style={{ color: "var(--ink-muted)", fontSize: "0.74rem", marginTop: "0.5rem", marginBottom: 0 }}>
            The password is encrypted at rest and never displayed again after saving. A read-only login with VIEW SERVER STATE (for CPU/deadlock
            metrics) and VIEW ANY DEFINITION (for query text) is enough - no admin rights needed.
          </p>
          {error && (
            <div className="error" style={{ marginTop: "0.5rem" }}>
              {error}
            </div>
          )}
        </Card>
      )}

      <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {instances.map((instance) => (
          <Card key={instance.Id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Link href={`/dashboard/sql-monitoring/${instance.Id}`} style={{ fontWeight: 600, color: "var(--primary)" }}>
                {instance.Name}
              </Link>
              <Badge tone={statusTone(instance)}>{!instance.Enabled ? "Disabled" : instance.LastCheckStatus ?? "Pending"}</Badge>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
              <Badge tone="neutral">{ENGINE_LABELS[instance.Engine] ?? instance.Engine}</Badge>{" "}
              {instance.IsSelfMonitoring ? "This app's own database" : `${instance.HostName}:${instance.Port}`}
            </div>
            {instance.latestMetrics && (
              <div style={{ display: "flex", gap: "1rem", fontSize: "0.78rem", flexWrap: "wrap" }}>
                <span>CPU {instance.latestMetrics.CpuPct != null ? `${instance.latestMetrics.CpuPct.toFixed(0)}%` : "—"}</span>
                <span>Mem {instance.latestMetrics.MemoryUsedMB != null ? `${(instance.latestMetrics.MemoryUsedMB / 1024).toFixed(1)} GB` : "—"}</span>
                <span>PLE {instance.latestMetrics.PageLifeExpectancy ?? "—"}s</span>
                <span>Sessions {instance.latestMetrics.ActiveSessionCount ?? "—"}</span>
              </div>
            )}
            {instance.LastErrorMessage && (
              <p style={{ color: "var(--danger)", fontSize: "0.74rem", margin: 0 }}>{instance.LastErrorMessage}</p>
            )}
            <div className="flex items-center gap-2" style={{ marginTop: "0.25rem" }}>
              <button type="button" onClick={() => toggleEnabled(instance)} style={{ fontSize: "0.78rem" }}>
                {instance.Enabled ? "Disable" : "Enable"}
              </button>
              {instance.Engine !== "mssql" && (
                instance.HasSshBackupCheck ? (
                  <button type="button" onClick={() => clearSshConfig(instance.Id)} style={{ fontSize: "0.78rem" }}>
                    Backup Check: SSH configured (clear)
                  </button>
                ) : (
                  <button type="button" onClick={() => openSshForm(instance)} style={{ fontSize: "0.78rem" }}>
                    Configure Backup Check (SSH)
                  </button>
                )
              )}
              {!instance.IsSelfMonitoring && (
                <button type="button" onClick={() => remove(instance)} style={{ fontSize: "0.78rem", color: "var(--danger)", background: "none", border: "none", cursor: "pointer" }}>
                  Remove
                </button>
              )}
            </div>

            {sshFormInstanceId === instance.Id && (
              <form onSubmit={(e) => saveSshConfig(e, instance.Id)} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
                <div style={fieldWrapStyle}>
                  <label style={{ display: "block", fontSize: "0.72rem", color: "var(--ink-muted)", marginBottom: "0.2rem" }}>SSH Host</label>
                  <input value={sshHost} onChange={(e) => setSshHost(e.target.value)} required style={inputStyle} placeholder="e.g. same as HostName" />
                </div>
                <div style={{ flex: "1 1 90px" }}>
                  <label style={{ display: "block", fontSize: "0.72rem", color: "var(--ink-muted)", marginBottom: "0.2rem" }}>Port</label>
                  <input value={sshPort} onChange={(e) => setSshPort(e.target.value)} style={inputStyle} />
                </div>
                <div style={fieldWrapStyle}>
                  <label style={{ display: "block", fontSize: "0.72rem", color: "var(--ink-muted)", marginBottom: "0.2rem" }}>SSH Username</label>
                  <input value={sshUsername} onChange={(e) => setSshUsername(e.target.value)} required style={inputStyle} />
                </div>
                <div style={fieldWrapStyle}>
                  <label style={{ display: "block", fontSize: "0.72rem", color: "var(--ink-muted)", marginBottom: "0.2rem" }}>SSH Password</label>
                  <input type="password" value={sshPassword} onChange={(e) => setSshPassword(e.target.value)} required style={inputStyle} />
                </div>
                <div style={fieldWrapStyle}>
                  <label style={{ display: "block", fontSize: "0.72rem", color: "var(--ink-muted)", marginBottom: "0.2rem" }}>Backup Dir (optional)</label>
                  <input value={backupBaseDir} onChange={(e) => setBackupBaseDir(e.target.value)} style={inputStyle} placeholder="/var/lib/automysqlbackup" />
                </div>
                <button type="submit" className="submit" disabled={sshSubmitting} style={{ width: "auto", marginTop: 0, padding: "0.4rem 1rem" }}>
                  {sshSubmitting ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={() => setSshFormInstanceId(null)} style={{ fontSize: "0.78rem" }}>
                  Cancel
                </button>
                {sshError && <div className="error" style={{ width: "100%" }}>{sshError}</div>}
                <p style={{ color: "var(--ink-muted)", fontSize: "0.72rem", margin: 0, width: "100%" }}>
                  Reads last-backup file timestamps over SSH (currently supports AutoMySQLBackup's daily/weekly/monthly directory layout) - no
                  data is written, only read. Password is encrypted at rest.
                </p>
              </form>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
