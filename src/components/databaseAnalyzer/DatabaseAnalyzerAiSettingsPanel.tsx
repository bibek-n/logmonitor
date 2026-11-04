"use client";

import { useCallback, useEffect, useState } from "react";

type Mode = "non_ai" | "ai" | "hybrid";

interface AiConfigData {
  Provider: string | null;
  BaseUrl: string | null;
  Model: string | null;
  Mode: Mode;
  Enabled: boolean;
  ApiKeySet: boolean;
  LastTestAt: string | null;
  LastTestSuccess: boolean | null;
  LastTestMessage: string | null;
}

const MODE_LABELS: Record<Mode, string> = {
  non_ai: "Non-AI (rule engine only)",
  ai: "AI (model reviews the schema directly)",
  hybrid: "Hybrid (rule engine + AI, findings merged)",
};

export default function DatabaseAnalyzerAiSettingsPanel() {
  const [data, setData] = useState<AiConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const [form, setForm] = useState({ provider: "", baseUrl: "", apiKey: "", model: "", mode: "non_ai" as Mode, enabled: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/database-analyzer/ai-config");
      const result = await res.json();
      if (res.ok && result.ok && result.data) {
        setData(result.data);
        setForm({
          provider: result.data.Provider ?? "",
          baseUrl: result.data.BaseUrl ?? "",
          apiKey: "",
          model: result.data.Model ?? "",
          mode: result.data.Mode ?? "non_ai",
          enabled: result.data.Enabled ?? false,
        });
      }
    } catch {
      // Panel just stays in its loading-failed state - the rest of the module (connections,
      // scans) doesn't depend on this succeeding.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/database-analyzer/ai-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok || !result.ok) {
        setError(result.error ?? "Failed to save AI settings.");
      } else {
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save AI settings.");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/database-analyzer/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: form.apiKey || undefined, baseUrl: form.baseUrl || undefined, model: form.model || undefined }),
      });
      const result = await res.json();
      setTestMessage(result.ok ? result.message : `Failed: ${result.message ?? result.error}`);
    } catch (err) {
      setTestMessage(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setTesting(false);
    }
  }

  if (loading) return null;

  return (
    <div className="dash-panel" style={{ marginBottom: "1rem" }}>
      <div className="flex items-center justify-between" style={{ cursor: "pointer" }} onClick={() => setExpanded((v) => !v)}>
        <div>
          <strong style={{ fontSize: "0.9rem" }}>AI Settings</strong>
          <span style={{ marginLeft: "0.6rem", fontSize: "0.78rem", color: "var(--ink-muted)" }}>
            Current mode: {MODE_LABELS[data?.Mode ?? "non_ai"]}
            {data?.Enabled ? "" : " — AI disabled"}
          </span>
        </div>
        <span style={{ fontSize: "0.78rem", color: "var(--series-1)" }}>{expanded ? "Hide" : "Configure"}</span>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2" style={{ marginTop: "0.75rem" }}>
          {error && <div className="error">{error}</div>}
          <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", margin: 0 }}>
            A separate AI configuration for this module only - never shared with any other AI feature in this app.
            Non-AI mode (the default) needs no configuration at all and always works.
          </p>

          <div className="field">
            <label>Mode</label>
            <select
              value={form.mode}
              onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as Mode }))}
              style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)" }}
            >
              <option value="non_ai">{MODE_LABELS.non_ai}</option>
              <option value="ai">{MODE_LABELS.ai}</option>
              <option value="hybrid">{MODE_LABELS.hybrid}</option>
            </select>
          </div>

          <div className="field">
            <label>
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} style={{ marginRight: "0.4rem" }} />
              Enable AI analysis (when off, every scan always falls back to Non-AI regardless of the mode above)
            </label>
          </div>

          <div className="flex gap-2">
            <div className="field" style={{ flex: 1 }}>
              <label>Base URL (optional - OpenAI-compatible endpoint)</label>
              <input value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} placeholder="https://api.openai.com/v1" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Model</label>
              <input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="gpt-4o-mini" />
            </div>
          </div>

          <div className="field">
            <label>API Key {data?.ApiKeySet ? "(set - leave blank to keep it unchanged)" : "(not set)"}</label>
            <input type="password" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} placeholder={data?.ApiKeySet ? "••••••••" : "sk-..."} />
          </div>

          {testMessage && (
            <div style={{ fontSize: "0.78rem", color: testMessage.startsWith("Failed") ? "var(--danger)" : "var(--success)" }}>{testMessage}</div>
          )}
          {data?.LastTestAt && !testMessage && (
            <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
              Last test: {new Date(data.LastTestAt).toLocaleString()} — {data.LastTestSuccess ? "succeeded" : "failed"}
              {data.LastTestMessage ? ` (${data.LastTestMessage})` : ""}
            </div>
          )}

          <div className="flex gap-2" style={{ marginTop: "0.25rem" }}>
            <button
              type="button"
              onClick={test}
              disabled={testing}
              style={{ background: "transparent", border: "1px solid var(--series-1)", color: "var(--series-1)", borderRadius: 6, padding: "0.45rem 1rem", cursor: "pointer" }}
            >
              {testing ? "Testing..." : "Test"}
            </button>
            <button className="submit" onClick={save} disabled={saving} style={{ width: "auto", marginTop: 0, padding: "0.45rem 1.25rem" }}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
