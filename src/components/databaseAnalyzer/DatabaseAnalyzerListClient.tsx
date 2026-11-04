"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

type Engine = "mssql" | "mysql" | "postgres";
const ENGINE_LABELS: Record<Engine, string> = { mssql: "SQL Server", mysql: "MySQL", postgres: "PostgreSQL" };

type ConnectionSource = "live" | "upload";

interface ConnectionRow {
  Id: number;
  Name: string;
  Engine: Engine;
  Source: ConnectionSource;
  HostName: string | null;
  Port: number | null;
  DatabaseName: string | null;
  Username: string | null;
  SourceFileName: string | null;
  Enabled: boolean;
  LatestScanId: number | null;
  LatestScanDate: string | null;
  LatestStatus: string | null;
  LatestScore: number | null;
  LatestRisk: string | null;
}

type Tone = "success" | "info" | "warning" | "danger" | "neutral";
function riskTone(risk: string | null): Tone {
  switch (risk) {
    case "Low":
      return "success";
    case "Medium":
      return "info";
    case "High":
      return "warning";
    case "Critical":
      return "danger";
    default:
      return "neutral";
  }
}

const DEFAULT_PORTS: Record<Engine, number> = { mssql: 1433, mysql: 3306, postgres: 5432 };

export default function DatabaseAnalyzerListClient() {
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [scanningIds, setScanningIds] = useState<Set<number>>(new Set());
  const [testingIds, setTestingIds] = useState<Set<number>>(new Set());
  const [testResult, setTestResult] = useState<Record<number, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<ConnectionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [addMode, setAddMode] = useState<ConnectionSource>("live");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadEngine, setUploadEngine] = useState<Engine>("mssql");

  const [form, setForm] = useState({ name: "", engine: "mssql" as Engine, host: "", port: "1433", database: "", username: "", password: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/database-analyzer/connections");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to load connections.");
      } else {
        setConnections(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    if (!form.name.trim() || !form.host.trim() || !form.database.trim() || !form.username.trim() || !form.password) {
      setError("All fields are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/database-analyzer/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, port: Number(form.port) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to add connection.");
      } else {
        setAddOpen(false);
        setForm({ name: "", engine: "mssql", host: "", port: "1433", database: "", username: "", password: "" });
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add connection.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload() {
    if (!uploadName.trim() || !uploadFile) {
      setError("Name and a .sql file are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("name", uploadName.trim());
      body.append("engine", uploadEngine);
      body.append("file", uploadFile);
      const res = await fetch("/api/admin/database-analyzer/connections/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to upload SQL file.");
      } else {
        setAddOpen(false);
        setUploadFile(null);
        setUploadName("");
        setUploadEngine("mssql");
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload SQL file.");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(id: number) {
    setTestingIds((prev) => new Set(prev).add(id));
    setTestResult((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/database-analyzer/connections/${id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult((prev) => ({ ...prev, [id]: data.ok ? "Connected successfully." : `Failed: ${data.error}` }));
    } catch (err) {
      setTestResult((prev) => ({ ...prev, [id]: `Failed: ${err instanceof Error ? err.message : "Unknown error"}` }));
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function runScan(id: number) {
    setScanningIds((prev) => new Set(prev).add(id));
    setError(null);
    try {
      const res = await fetch(`/api/admin/database-analyzer/connections/${id}/scan`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) setError(data.error ?? "Scan failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setScanningIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/database-analyzer/connections/${deleteTarget.Id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) setError(data.error ?? "Failed to delete connection.");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {error && (
        <div className="error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div className="dash-panel" style={{ marginBottom: "1rem" }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
            {connections.length} connection{connections.length === 1 ? "" : "s"}
          </span>
          <button className="submit" onClick={() => setAddOpen(true)} style={{ width: "auto", marginTop: 0, padding: "0.5rem 1rem" }}>
            + Add Connection
          </button>
        </div>
      </div>

      <div className="dash-panel">
        {loading ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : connections.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No database connections yet. Click &quot;Add Connection&quot; to register one.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}>Connection</th>
                <th style={{ padding: "0.5rem" }}>Engine</th>
                <th style={{ padding: "0.5rem" }}>Last Scan</th>
                <th style={{ padding: "0.5rem" }}>Score</th>
                <th style={{ padding: "0.5rem" }}>Risk</th>
                <th style={{ padding: "0.5rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => {
                const scanning = scanningIds.has(c.Id);
                const testing = testingIds.has(c.Id);
                return (
                  <tr key={c.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.5rem" }}>
                      <Link href={`/dashboard/database-analyzer/${c.Id}`} style={{ color: "var(--series-1)", textDecoration: "none" }}>
                        {c.Name}
                      </Link>
                      <div style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}>
                        {c.Source === "upload" ? (
                          <>Uploaded file: {c.SourceFileName ?? "—"}</>
                        ) : (
                          <>{c.HostName}:{c.Port}/{c.DatabaseName}</>
                        )}
                      </div>
                      {testResult[c.Id] && (
                        <div style={{ fontSize: "0.72rem", color: testResult[c.Id].startsWith("Connected") ? "var(--success)" : "var(--danger)" }}>
                          {testResult[c.Id]}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.5rem" }}>{ENGINE_LABELS[c.Engine]}</td>
                    <td style={{ padding: "0.5rem" }}>{c.LatestScanDate ? new Date(c.LatestScanDate).toLocaleDateString() : "Never scanned"}</td>
                    <td style={{ padding: "0.5rem" }}>{c.LatestScore ?? "—"}</td>
                    <td style={{ padding: "0.5rem" }}>{c.LatestRisk ? <Badge tone={riskTone(c.LatestRisk)}>{c.LatestRisk}</Badge> : <Badge tone="neutral">Not scanned</Badge>}</td>
                    <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => runScan(c.Id)}
                        disabled={scanning}
                        className="submit"
                        style={{ width: "auto", marginTop: 0, padding: "0.35rem 0.8rem", fontSize: "0.78rem", marginRight: "0.4rem" }}
                      >
                        {scanning ? "Scanning..." : "Scan now"}
                      </button>
                      {c.Source === "live" && (
                        <button
                          onClick={() => testConnection(c.Id)}
                          disabled={testing}
                          style={{ background: "transparent", border: "1px solid var(--series-1)", color: "var(--series-1)", borderRadius: 6, padding: "0.35rem 0.8rem", fontSize: "0.78rem", cursor: "pointer", marginRight: "0.4rem" }}
                        >
                          {testing ? "Testing..." : "Test"}
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(c)}
                        style={{ background: "none", border: "none", color: "var(--danger)", fontSize: "0.78rem", cursor: "pointer" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Database Connection"
        footer={
          <>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.45rem 1rem", color: "var(--ink)", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              className="submit"
              onClick={addMode === "live" ? handleAdd : handleUpload}
              disabled={saving}
              style={{ width: "auto", padding: "0.45rem 1.25rem" }}
            >
              {saving ? "Saving..." : "Add"}
            </button>
          </>
        }
      >
        <div className="flex gap-2" style={{ marginBottom: "0.75rem" }}>
          {(["live", "upload"] as ConnectionSource[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setAddMode(m)}
              style={{
                flex: 1,
                padding: "0.5rem",
                borderRadius: 6,
                border: `1px solid ${addMode === m ? "var(--series-1)" : "var(--border)"}`,
                background: addMode === m ? "var(--series-1)" : "transparent",
                color: addMode === m ? "#fff" : "var(--ink)",
                cursor: "pointer",
                fontSize: "0.82rem",
              }}
            >
              {m === "live" ? "Live Connection" : "Upload SQL File"}
            </button>
          ))}
        </div>

        {addMode === "live" ? (
          <div className="flex flex-col gap-2">
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Client X Production DB" />
            </div>
            <div className="field">
              <label>Engine</label>
              <select
                value={form.engine}
                onChange={(e) => {
                  const engine = e.target.value as Engine;
                  setForm((f) => ({ ...f, engine, port: String(DEFAULT_PORTS[engine]) }));
                }}
                style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)" }}
              >
                <option value="mssql">SQL Server</option>
                <option value="mysql">MySQL</option>
                <option value="postgres">PostgreSQL</option>
              </select>
            </div>
            <div className="flex gap-2">
              <div className="field" style={{ flex: 2 }}>
                <label>Host</label>
                <input value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} placeholder="db.example.com" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Port</label>
                <input value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>Database name</label>
              <input value={form.database} onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))} />
            </div>
            <div className="field">
              <label>Username</label>
              <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", margin: 0 }}>
              Credentials are encrypted at rest. For least privilege, use a read-only account — this scan only ever
              reads schema metadata, never actual row data.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="field">
              <label>Name</label>
              <input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="e.g. Client X schema export" />
            </div>
            <div className="field">
              <label>Engine (for parsing the SQL dialect)</label>
              <select
                value={uploadEngine}
                onChange={(e) => setUploadEngine(e.target.value as Engine)}
                style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)" }}
              >
                <option value="mssql">SQL Server</option>
                <option value="mysql">MySQL</option>
                <option value="postgres">PostgreSQL</option>
              </select>
            </div>
            <div className="field">
              <label>.sql file</label>
              <input type="file" accept=".sql" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", margin: 0 }}>
              A schema-only dump or CREATE TABLE script (e.g. SSMS &quot;Script Table as CREATE&quot;, mysqldump
              --no-data, pg_dump --schema-only), up to 20 MB. Parsed for table/column/key structure only - no live
              connection is made and no row data is ever involved. The file is kept so this connection can be
              re-scanned later without re-uploading.
            </p>
          </div>
        )}
      </Modal>

      {deleteTarget && (
        <Modal
          open
          onClose={() => setDeleteTarget(null)}
          title={`Delete "${deleteTarget.Name}"?`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.45rem 1rem", color: "var(--ink)", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={saving}
                style={{ background: "var(--danger)", border: "none", borderRadius: 6, padding: "0.45rem 1.25rem", color: "#fff", cursor: "pointer" }}
              >
                {saving ? "Deleting..." : "Delete"}
              </button>
            </>
          }
        >
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>This removes the connection and all its scan history. This can&apos;t be undone.</p>
        </Modal>
      )}
    </>
  );
}
