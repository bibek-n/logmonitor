"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const PROVIDER_TYPES = ["M365", "GoogleWorkspace", "ExchangeServer", "SmtpImap", "Generic"];

interface ConnectionRow {
  Id: number;
  ProviderType: string;
  DisplayName: string;
  Status: string;
  LastTestedAt: string | null;
  LastTestResult: string | null;
  IsActive: boolean;
}

const inputStyle = {
  width: "100%",
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function ConnectorsInner() {
  const toast = useToast();
  const [rows, setRows] = useState<ConnectionRow[] | null>(null);
  const [providerType, setProviderType] = useState(PROVIDER_TYPES[0]);
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/mail-security/providers");
    const data = await res.json();
    if (res.ok && data.ok) setRows(data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!displayName.trim()) {
      toast.show({ type: "error", message: "Display name is required." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/mail-security/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerType, displayName: displayName.trim(), config: {} }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to add connection.");
      toast.show({ type: "success", message: data.note ?? "Connection added." });
      setDisplayName("");
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to add connection." });
    } finally {
      setSubmitting(false);
    }
  }

  async function test(id: number) {
    setTestingId(id);
    try {
      const res = await fetch(`/api/admin/mail-security/providers/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Test failed.");
      toast.show({ type: data.data.ok ? "success" : "error", message: data.data.message });
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Test failed." });
    } finally {
      setTestingId(null);
    }
  }

  async function remove(id: number) {
    const res = await fetch(`/api/admin/mail-security/providers/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to remove connection." });
      return;
    }
    await load();
  }

  return (
    <div>
      <Card style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: "0.6rem", alignItems: "end" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Provider</label>
            <select value={providerType} onChange={(e) => setProviderType(e.target.value)} style={inputStyle}>
              {PROVIDER_TYPES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Display name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} placeholder="e.g. Company M365 tenant" />
          </div>
          <Button onClick={add} disabled={submitting}>
            {submitting ? "Adding..." : "Add"}
          </Button>
        </div>
      </Card>

      {rows === null ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No connections yet.</p>
      ) : (
        <div className="dash-panel">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Provider</th>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Status</th>
                  <th style={{ padding: "0.4rem" }}>Last Test Result</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{r.ProviderType}</td>
                    <td style={{ padding: "0.4rem" }}>{r.DisplayName}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <span style={{ color: r.Status === "Connected" ? "var(--success)" : "var(--ink-muted)" }}>{r.Status}</span>
                    </td>
                    <td style={{ padding: "0.4rem", maxWidth: 360, fontSize: "0.78rem", color: "var(--ink-muted)" }}>{r.LastTestResult ?? "-"}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <Button size="sm" variant="secondary" onClick={() => test(r.Id)} disabled={testingId === r.Id}>
                          {testingId === r.Id ? "Testing..." : "Test"}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove(r.Id)}>
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConnectorsClient() {
  return (
    <ToastProvider>
      <ConnectorsInner />
    </ToastProvider>
  );
}
