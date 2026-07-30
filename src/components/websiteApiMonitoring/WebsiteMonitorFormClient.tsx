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

const inputStyle = {
  width: "100%",
  padding: "0.55rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

export interface WebsiteMonitorFormValues {
  name: string;
  description: string;
  environment: string;
  tags: string;
  intervalSeconds: number;
  timeoutMs: number;
  failureConfirmCount: number;
  recoveryConfirmCount: number;
  url: string;
  httpMethod: "GET" | "HEAD";
  expectedStatusCode: number;
  followRedirects: boolean;
  maxRedirects: number;
  sslVerify: boolean;
  expectedKeyword: string;
  forbiddenKeyword: string;
  responseTimeWarningMs: number;
  responseTimeCriticalMs: number;
  alertEmail: string;
  isActive: boolean;
}

const DEFAULT_VALUES: WebsiteMonitorFormValues = {
  name: "",
  description: "",
  environment: "Production",
  tags: "",
  intervalSeconds: 300,
  timeoutMs: 10000,
  failureConfirmCount: 2,
  recoveryConfirmCount: 1,
  url: "",
  httpMethod: "GET",
  expectedStatusCode: 200,
  followRedirects: true,
  maxRedirects: 5,
  sslVerify: true,
  expectedKeyword: "",
  forbiddenKeyword: "",
  responseTimeWarningMs: 1000,
  responseTimeCriticalMs: 3000,
  alertEmail: "",
  isActive: true,
};

function toPayload(v: WebsiteMonitorFormValues) {
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
    expectedStatusCode: v.expectedStatusCode,
    followRedirects: v.followRedirects,
    maxRedirects: v.maxRedirects,
    sslVerify: v.sslVerify,
    expectedKeyword: v.expectedKeyword || null,
    forbiddenKeyword: v.forbiddenKeyword || null,
    responseTimeWarningMs: v.responseTimeWarningMs,
    responseTimeCriticalMs: v.responseTimeCriticalMs,
    alertEmail: v.alertEmail.trim() || null,
  };
}

function TestResultView({ result }: { result: Record<string, unknown> }) {
  return (
    <div style={{ marginTop: "0.75rem", padding: "0.6rem", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{result.success ? <span style={{ color: "var(--success)" }}>Check succeeded</span> : <span style={{ color: "var(--danger)" }}>Check failed</span>}</div>
      <pre style={{ fontSize: "0.72rem", maxHeight: 260, overflow: "auto", background: "var(--surface)", padding: "0.5rem", borderRadius: 6 }}>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}

function WebsiteMonitorFormInner({ monitorId, initial }: { monitorId: number | "new"; initial?: Partial<WebsiteMonitorFormValues> }) {
  const toast = useToast();
  const router = useRouter();
  const [values, setValues] = useState<WebsiteMonitorFormValues>({ ...DEFAULT_VALUES, ...initial });
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);

  function set<K extends keyof WebsiteMonitorFormValues>(key: K, val: WebsiteMonitorFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/monitoring/websites/${monitorId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: values.url,
          httpMethod: values.httpMethod,
          expectedStatusCode: values.expectedStatusCode,
          followRedirects: values.followRedirects,
          maxRedirects: values.maxRedirects,
          sslVerify: values.sslVerify,
          expectedKeyword: values.expectedKeyword || null,
          forbiddenKeyword: values.forbiddenKeyword || null,
          timeoutMs: values.timeoutMs,
        }),
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
      const res = await fetch(isNew ? "/api/admin/monitoring/websites" : `/api/admin/monitoring/websites/${monitorId}`, {
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
        router.push("/dashboard/monitoring/websites");
      }
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save monitor." });
    } finally {
      setSubmitting(false);
    }
  }

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

      <div className="field">
        <label>Website URL</label>
        <input value={values.url} onChange={(e) => set("url", e.target.value)} style={inputStyle} placeholder="https://example.com" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>HTTP Method</label>
          <select value={values.httpMethod} onChange={(e) => set("httpMethod", e.target.value as "GET" | "HEAD")} style={inputStyle}>
            <option value="GET">GET</option>
            <option value="HEAD">HEAD</option>
          </select>
        </div>
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
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Request Timeout (ms)</label>
          <input type="number" value={values.timeoutMs} onChange={(e) => set("timeoutMs", Number(e.target.value))} style={inputStyle} />
        </div>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Expected Keyword (content must contain)</label>
          <input value={values.expectedKeyword} onChange={(e) => set("expectedKeyword", e.target.value)} style={inputStyle} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Forbidden Keyword (content must not contain)</label>
          <input value={values.forbiddenKeyword} onChange={(e) => set("forbiddenKeyword", e.target.value)} style={inputStyle} />
        </div>
      </div>

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
        <input
          value={values.alertEmail}
          onChange={(e) => set("alertEmail", e.target.value)}
          style={inputStyle}
          placeholder="ops@example.com, oncall@example.com"
        />
        <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: "0.3rem" }}>
          Send this monitor&apos;s Down/Recovered/Degraded/SSL alerts to these address(es) too, on top of whatever the
          assigned Alert Policy already notifies. Separate multiple addresses with a comma.
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

export function WebsiteMonitorFormClient(props: { monitorId: number | "new"; initial?: Partial<WebsiteMonitorFormValues> }) {
  return (
    <ToastProvider>
      <WebsiteMonitorFormInner {...props} />
    </ToastProvider>
  );
}
