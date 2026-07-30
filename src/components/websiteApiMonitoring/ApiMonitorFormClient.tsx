"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const INTERVAL_OPTIONS = [
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
  { value: 900, label: "15 minutes" },
  { value: 1800, label: "30 minutes" },
  { value: 3600, label: "1 hour" },
];

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
const AUTH_TYPES = ["None", "ApiKey", "BearerToken", "BasicAuth", "OAuth2ClientCredentials"] as const;
const ASSERTION_OPERATORS = ["equals", "notEquals", "contains", "notContains", "exists", "notExists", "greaterThan", "lessThan", "matchesRegex"] as const;
const SECRET_MASK_PLACEHOLDER = "••••••••";

const inputStyle = {
  width: "100%",
  padding: "0.55rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

interface KeyValue {
  key: string;
  value: string;
}

interface AssertionRow {
  path: string;
  operator: (typeof ASSERTION_OPERATORS)[number];
  expectedValue: string;
}

export interface ApiMonitorFormValues {
  name: string;
  description: string;
  environment: string;
  tags: string;
  intervalSeconds: number;
  timeoutMs: number;
  failureConfirmCount: number;
  recoveryConfirmCount: number;
  isActive: boolean;
  url: string;
  httpMethod: (typeof HTTP_METHODS)[number];
  headers: KeyValue[];
  queryParams: KeyValue[];
  requestBody: string;
  requestBodyContentType: string;
  authType: (typeof AUTH_TYPES)[number];
  keyLocation: "header" | "query";
  keyName: string;
  keyValue: string;
  token: string;
  username: string;
  password: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  expectedStatusCode: number;
  followRedirects: boolean;
  maxRedirects: number;
  sslVerify: boolean;
  assertions: AssertionRow[];
  responseTimeWarningMs: number;
  responseTimeCriticalMs: number;
  alertEmail: string;
}

const DEFAULT_VALUES: ApiMonitorFormValues = {
  name: "",
  description: "",
  environment: "Production",
  tags: "",
  intervalSeconds: 300,
  timeoutMs: 10000,
  failureConfirmCount: 2,
  recoveryConfirmCount: 1,
  isActive: true,
  url: "",
  httpMethod: "GET",
  headers: [],
  queryParams: [],
  requestBody: "",
  requestBodyContentType: "application/json",
  authType: "None",
  keyLocation: "header",
  keyName: "",
  keyValue: "",
  token: "",
  username: "",
  password: "",
  tokenUrl: "",
  clientId: "",
  clientSecret: "",
  scope: "",
  expectedStatusCode: 200,
  followRedirects: true,
  maxRedirects: 5,
  sslVerify: true,
  assertions: [],
  responseTimeWarningMs: 1000,
  responseTimeCriticalMs: 3000,
  alertEmail: "",
};

function buildAuthConfig(v: ApiMonitorFormValues) {
  switch (v.authType) {
    case "None":
      return { type: "None" as const };
    case "ApiKey":
      return { type: "ApiKey" as const, keyLocation: v.keyLocation, keyName: v.keyName, keyValue: v.keyValue };
    case "BearerToken":
      return { type: "BearerToken" as const, token: v.token };
    case "BasicAuth":
      return { type: "BasicAuth" as const, username: v.username, password: v.password };
    case "OAuth2ClientCredentials":
      return { type: "OAuth2ClientCredentials" as const, tokenUrl: v.tokenUrl, clientId: v.clientId, clientSecret: v.clientSecret, scope: v.scope || null };
  }
}

function toPayload(v: ApiMonitorFormValues) {
  return {
    name: v.name,
    description: v.description || null,
    environment: v.environment || null,
    tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
    intervalSeconds: v.intervalSeconds,
    timeoutMs: v.timeoutMs,
    failureConfirmCount: v.failureConfirmCount,
    recoveryConfirmCount: v.recoveryConfirmCount,
    isActive: v.isActive,
    url: v.url,
    httpMethod: v.httpMethod,
    headers: v.headers.filter((h) => h.key.trim()),
    queryParams: v.queryParams.filter((h) => h.key.trim()),
    requestBody: v.httpMethod === "GET" || v.httpMethod === "HEAD" ? null : v.requestBody || null,
    requestBodyContentType: v.requestBodyContentType || null,
    authType: v.authType,
    authConfig: buildAuthConfig(v),
    expectedStatusCode: v.expectedStatusCode,
    followRedirects: v.followRedirects,
    maxRedirects: v.maxRedirects,
    sslVerify: v.sslVerify,
    assertions: v.assertions.filter((a) => a.path.trim()),
    responseTimeWarningMs: v.responseTimeWarningMs,
    responseTimeCriticalMs: v.responseTimeCriticalMs,
    alertEmail: v.alertEmail.trim() || null,
  };
}

function KeyValueEditor({ label, rows, onChange }: { label: string; rows: KeyValue[]; onChange: (rows: KeyValue[]) => void }) {
  function update(i: number, field: "key" | "value", val: string) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  }
  return (
    <div className="field">
      <label>{label}</label>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
          <input value={r.key} onChange={(e) => update(i, "key", e.target.value)} style={inputStyle} placeholder="Name" />
          <input value={r.value} onChange={(e) => update(i, "value", e.target.value)} style={inputStyle} placeholder="Value" />
          <Button size="sm" variant="danger" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>
            Remove
          </Button>
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={() => onChange([...rows, { key: "", value: "" }])}>
        Add {label.slice(0, -1)}
      </Button>
    </div>
  );
}

function AssertionsEditor({ rows, onChange }: { rows: AssertionRow[]; onChange: (rows: AssertionRow[]) => void }) {
  function update(i: number, patch: Partial<AssertionRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  return (
    <div className="field">
      <label>Response Assertions (JSONPath)</label>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1.3fr auto", gap: "0.4rem", marginBottom: "0.4rem" }}>
          <input value={r.path} onChange={(e) => update(i, { path: e.target.value })} style={inputStyle} placeholder="$.data.status" />
          <select value={r.operator} onChange={(e) => update(i, { operator: e.target.value as AssertionRow["operator"] })} style={inputStyle}>
            {ASSERTION_OPERATORS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          <input
            value={r.expectedValue}
            onChange={(e) => update(i, { expectedValue: e.target.value })}
            style={inputStyle}
            placeholder="Expected value"
            disabled={r.operator === "exists" || r.operator === "notExists"}
          />
          <Button size="sm" variant="danger" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>
            Remove
          </Button>
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={() => onChange([...rows, { path: "", operator: "equals", expectedValue: "" }])}>
        Add Assertion
      </Button>
      <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: "0.3rem" }}>
        A path like <code>$.data.items[0].id</code> or <code>status</code> is resolved against the parsed JSON response body. All assertions must pass for the check to succeed.
      </p>
    </div>
  );
}

function TestResultView({ result }: { result: Record<string, unknown> }) {
  return (
    <div style={{ marginTop: "0.75rem", padding: "0.6rem", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{result.success ? <span style={{ color: "var(--success)" }}>Check succeeded</span> : <span style={{ color: "var(--danger)" }}>Check failed</span>}</div>
      <pre style={{ fontSize: "0.72rem", maxHeight: 260, overflow: "auto", background: "var(--surface)", padding: "0.5rem", borderRadius: 6 }}>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}

function ApiMonitorFormInner({ monitorId, initial }: { monitorId: number | "new"; initial?: Partial<ApiMonitorFormValues> }) {
  const toast = useToast();
  const router = useRouter();
  const [values, setValues] = useState<ApiMonitorFormValues>({ ...DEFAULT_VALUES, ...initial });
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);

  function set<K extends keyof ApiMonitorFormValues>(key: K, val: ApiMonitorFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const payload = toPayload(values);
      const res = await fetch(`/api/admin/monitoring/api/${monitorId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, timeoutMs: values.timeoutMs }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Test failed.");
      setTestResult(data.data);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Test failed." });
    } finally {
      setTesting(false);
    }
  }

  async function save(andTest: boolean) {
    if (!values.name.trim() || !values.url.trim()) {
      toast.show({ type: "error", message: "Name and URL are required." });
      return;
    }
    setSubmitting(true);
    try {
      const isNew = monitorId === "new";
      const res = await fetch(isNew ? "/api/admin/monitoring/api" : `/api/admin/monitoring/api/${monitorId}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(values)),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save monitor.");
      toast.show({ type: "success", message: "Monitor saved." });
      if (andTest) {
        await runTest();
      } else {
        router.push("/dashboard/monitoring/api");
      }
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save monitor." });
    } finally {
      setSubmitting(false);
    }
  }

  const bodyAllowed = values.httpMethod !== "GET" && values.httpMethod !== "HEAD";

  return (
    <Card>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Monitor Name</label>
          <input value={values.name} onChange={(e) => set("name", e.target.value)} style={inputStyle} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Environment</label>
          <input value={values.environment} onChange={(e) => set("environment", e.target.value)} style={inputStyle} placeholder="Production / Staging / Development" />
        </div>
      </div>

      <div className="field">
        <label>Description</label>
        <input value={values.description} onChange={(e) => set("description", e.target.value)} style={inputStyle} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Method</label>
          <select value={values.httpMethod} onChange={(e) => set("httpMethod", e.target.value as ApiMonitorFormValues["httpMethod"])} style={inputStyle}>
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Endpoint URL</label>
          <input value={values.url} onChange={(e) => set("url", e.target.value)} style={inputStyle} placeholder="https://api.example.com/health" />
        </div>
      </div>

      <KeyValueEditor label="Headers" rows={values.headers} onChange={(r) => set("headers", r)} />
      <KeyValueEditor label="Query Params" rows={values.queryParams} onChange={(r) => set("queryParams", r)} />

      {bodyAllowed && (
        <>
          <div className="field">
            <label>Request Body Content Type</label>
            <input value={values.requestBodyContentType} onChange={(e) => set("requestBodyContentType", e.target.value)} style={{ ...inputStyle, maxWidth: 320 }} />
          </div>
          <div className="field">
            <label>Request Body</label>
            <textarea value={values.requestBody} onChange={(e) => set("requestBody", e.target.value)} style={{ ...inputStyle, fontFamily: "monospace", minHeight: 100 }} />
          </div>
        </>
      )}

      <div className="field">
        <label>Authentication</label>
        <select value={values.authType} onChange={(e) => set("authType", e.target.value as ApiMonitorFormValues["authType"])} style={{ ...inputStyle, maxWidth: 320 }}>
          {AUTH_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === "None" ? "None" : t === "ApiKey" ? "API Key" : t === "BearerToken" ? "Bearer Token" : t === "BasicAuth" ? "Basic Auth" : "OAuth2 Client Credentials"}
            </option>
          ))}
        </select>
      </div>

      {values.authType === "ApiKey" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Send In</label>
            <select value={values.keyLocation} onChange={(e) => set("keyLocation", e.target.value as "header" | "query")} style={inputStyle}>
              <option value="header">Header</option>
              <option value="query">Query Param</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Key Name</label>
            <input value={values.keyName} onChange={(e) => set("keyName", e.target.value)} style={inputStyle} placeholder="X-API-Key" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Key Value</label>
            <input
              type="password"
              value={values.keyValue}
              onChange={(e) => set("keyValue", e.target.value)}
              onFocus={() => values.keyValue === SECRET_MASK_PLACEHOLDER && set("keyValue", "")}
              style={inputStyle}
              placeholder={monitorId === "new" ? "" : "Leave unchanged to keep the saved key"}
            />
          </div>
        </div>
      )}

      {values.authType === "BearerToken" && (
        <div className="field">
          <label>Bearer Token</label>
          <input
            type="password"
            value={values.token}
            onChange={(e) => set("token", e.target.value)}
            onFocus={() => values.token === SECRET_MASK_PLACEHOLDER && set("token", "")}
            style={inputStyle}
            placeholder={monitorId === "new" ? "" : "Leave unchanged to keep the saved token"}
          />
        </div>
      )}

      {values.authType === "BasicAuth" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Username</label>
            <input value={values.username} onChange={(e) => set("username", e.target.value)} style={inputStyle} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Password</label>
            <input
              type="password"
              value={values.password}
              onChange={(e) => set("password", e.target.value)}
              onFocus={() => values.password === SECRET_MASK_PLACEHOLDER && set("password", "")}
              style={inputStyle}
              placeholder={monitorId === "new" ? "" : "Leave unchanged to keep the saved password"}
            />
          </div>
        </div>
      )}

      {values.authType === "OAuth2ClientCredentials" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Token URL</label>
            <input value={values.tokenUrl} onChange={(e) => set("tokenUrl", e.target.value)} style={inputStyle} placeholder="https://auth.example.com/oauth/token" />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Scope (optional)</label>
            <input value={values.scope} onChange={(e) => set("scope", e.target.value)} style={inputStyle} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Client ID</label>
            <input value={values.clientId} onChange={(e) => set("clientId", e.target.value)} style={inputStyle} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Client Secret</label>
            <input
              type="password"
              value={values.clientSecret}
              onChange={(e) => set("clientSecret", e.target.value)}
              onFocus={() => values.clientSecret === SECRET_MASK_PLACEHOLDER && set("clientSecret", "")}
              style={inputStyle}
              placeholder={monitorId === "new" ? "" : "Leave unchanged to keep the saved secret"}
            />
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Expected Status Code</label>
          <input type="number" value={values.expectedStatusCode} onChange={(e) => set("expectedStatusCode", Number(e.target.value))} style={inputStyle} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Monitoring Interval</label>
          <select value={values.intervalSeconds} onChange={(e) => set("intervalSeconds", Number(e.target.value))} style={inputStyle}>
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Request Timeout (ms)</label>
          <input type="number" value={values.timeoutMs} onChange={(e) => set("timeoutMs", Number(e.target.value))} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Failure Confirmation Count</label>
          <input type="number" value={values.failureConfirmCount} onChange={(e) => set("failureConfirmCount", Number(e.target.value))} style={inputStyle} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Recovery Confirmation Count</label>
          <input type="number" value={values.recoveryConfirmCount} onChange={(e) => set("recoveryConfirmCount", Number(e.target.value))} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}>
          <input type="checkbox" checked={values.followRedirects} onChange={(e) => set("followRedirects", e.target.checked)} />
          Follow redirects
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}>
          <input type="checkbox" checked={values.sslVerify} onChange={(e) => set("sslVerify", e.target.checked)} />
          Verify SSL certificate
        </label>
      </div>

      {values.followRedirects && (
        <div className="field">
          <label>Maximum Redirect Count</label>
          <input type="number" value={values.maxRedirects} onChange={(e) => set("maxRedirects", Number(e.target.value))} style={{ ...inputStyle, maxWidth: 160 }} />
        </div>
      )}

      <AssertionsEditor rows={values.assertions} onChange={(r) => set("assertions", r)} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Response-Time Warning Threshold (ms)</label>
          <input type="number" value={values.responseTimeWarningMs} onChange={(e) => set("responseTimeWarningMs", Number(e.target.value))} style={inputStyle} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Response-Time Critical Threshold (ms)</label>
          <input type="number" value={values.responseTimeCriticalMs} onChange={(e) => set("responseTimeCriticalMs", Number(e.target.value))} style={inputStyle} />
        </div>
      </div>

      <div className="field">
        <label>Alert Email (optional)</label>
        <input value={values.alertEmail} onChange={(e) => set("alertEmail", e.target.value)} style={inputStyle} placeholder="ops@example.com, oncall@example.com" />
        <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: "0.3rem" }}>
          Send this monitor&apos;s Down/Recovered/Degraded alerts to these address(es) too, on top of whatever the assigned Alert Policy already notifies. Separate multiple addresses with a comma.
        </p>
      </div>

      <div className="field">
        <label>Tags (comma-separated)</label>
        <input value={values.tags} onChange={(e) => set("tags", e.target.value)} style={inputStyle} />
      </div>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <Button onClick={() => save(false)} disabled={submitting}>
          {submitting ? "Saving..." : "Save"}
        </Button>
        <Button variant="secondary" onClick={() => save(true)} disabled={submitting}>
          Save and Test
        </Button>
        <Button variant="secondary" onClick={runTest} disabled={testing || !values.url}>
          {testing ? "Testing..." : "Test Monitor"}
        </Button>
      </div>

      {testResult && <TestResultView result={testResult} />}
    </Card>
  );
}

export function ApiMonitorFormClient(props: { monitorId: number | "new"; initial?: Partial<ApiMonitorFormValues> }) {
  return (
    <ToastProvider>
      <ApiMonitorFormInner {...props} />
    </ToastProvider>
  );
}
