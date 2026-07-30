"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const TABS = ["Rate Limit Rules", "Custom Rules", "Country Rules", "IP Blocklist", "WAF Events"] as const;
type Tab = (typeof TABS)[number];

const inputStyle = {
  padding: "0.45rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

interface RateLimitRule {
  id: number;
  name: string;
  requestsPerWindow: number;
  windowSeconds: number;
  action: string;
  isActive: boolean;
}
interface CustomRule {
  id: number;
  name: string;
  matchType: string;
  matchValue: string;
  action: string;
  isActive: boolean;
}
interface CountryRule {
  id: number;
  countryCode: string;
  action: string;
  isActive: boolean;
}

function RateLimitRulesTab() {
  const toast = useToast();
  const [rows, setRows] = useState<RateLimitRule[] | null>(null);
  const [name, setName] = useState("");
  const [requestsPerWindow, setRequestsPerWindow] = useState(100);
  const [windowSeconds, setWindowSeconds] = useState(60);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/security-center/waf/rate-limit-rules");
    const data = await res.json();
    if (res.ok && data.ok) setRows(data.data);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!name.trim()) {
      toast.show({ type: "error", message: "Name is required." });
      return;
    }
    const res = await fetch("/api/admin/security-center/waf/rate-limit-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, requestsPerWindow, windowSeconds, action: "LogOnly", isActive: true }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to create rule." });
      return;
    }
    setName("");
    await load();
  }

  async function remove(id: number) {
    await fetch(`/api/admin/security-center/waf/rate-limit-rules/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>
        Phase 1: configuration and logging only — not yet wired into live request-path enforcement (see plan notes).
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "0.7rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem" }}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem" }}>Requests</label>
          <input type="number" value={requestsPerWindow} onChange={(e) => setRequestsPerWindow(Number(e.target.value))} style={{ ...inputStyle, width: 90 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem" }}>Per (seconds)</label>
          <input type="number" value={windowSeconds} onChange={(e) => setWindowSeconds(Number(e.target.value))} style={{ ...inputStyle, width: 90 }} />
        </div>
        <Button onClick={create}>Add Rule</Button>
      </div>
      {rows?.map((r) => (
        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--grid)" }}>
          <span>
            {r.name} — {r.requestsPerWindow} req / {r.windowSeconds}s ({r.action})
          </span>
          <Button size="sm" variant="danger" onClick={() => remove(r.id)}>
            Delete
          </Button>
        </div>
      ))}
    </div>
  );
}

function CustomRulesTab() {
  const toast = useToast();
  const [rows, setRows] = useState<CustomRule[] | null>(null);
  const [name, setName] = useState("");
  const [matchType, setMatchType] = useState<"UrlPattern" | "UserAgentPattern" | "HeaderPattern">("UrlPattern");
  const [matchValue, setMatchValue] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/security-center/waf/custom-rules");
    const data = await res.json();
    if (res.ok && data.ok) setRows(data.data);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!name.trim() || !matchValue.trim()) {
      toast.show({ type: "error", message: "Name and match value are required." });
      return;
    }
    const res = await fetch("/api/admin/security-center/waf/custom-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, matchType, matchValue, action: "LogOnly", isActive: true }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to create rule." });
      return;
    }
    setName("");
    setMatchValue("");
    await load();
  }

  async function remove(id: number) {
    await fetch(`/api/admin/security-center/waf/custom-rules/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "0.7rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem" }}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem" }}>Match Type</label>
          <select value={matchType} onChange={(e) => setMatchType(e.target.value as typeof matchType)} style={inputStyle}>
            <option value="UrlPattern">URL Pattern</option>
            <option value="UserAgentPattern">User Agent Pattern</option>
            <option value="HeaderPattern">Header Pattern</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem" }}>Match Value</label>
          <input value={matchValue} onChange={(e) => setMatchValue(e.target.value)} style={{ ...inputStyle, minWidth: 220 }} />
        </div>
        <Button onClick={create}>Add Rule</Button>
      </div>
      {rows?.map((r) => (
        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--grid)" }}>
          <span>
            {r.name} — {r.matchType}: {r.matchValue} ({r.action})
          </span>
          <Button size="sm" variant="danger" onClick={() => remove(r.id)}>
            Delete
          </Button>
        </div>
      ))}
    </div>
  );
}

function CountryRulesTab() {
  const toast = useToast();
  const [rows, setRows] = useState<CountryRule[] | null>(null);
  const [countryCode, setCountryCode] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/security-center/waf/country-rules");
    const data = await res.json();
    if (res.ok && data.ok) setRows(data.data);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (countryCode.trim().length !== 2) {
      toast.show({ type: "error", message: "Enter a 2-letter ISO country code (e.g. US, CN, RU)." });
      return;
    }
    const res = await fetch("/api/admin/security-center/waf/country-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryCode, action: "Block", isActive: true }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to create rule." });
      return;
    }
    setCountryCode("");
    await load();
  }

  async function remove(id: number) {
    await fetch(`/api/admin/security-center/waf/country-rules/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>
        Logged/informational only in Phase 1 — real per-country enforcement needs GeoIP-to-CIDR mapping not yet built.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", marginBottom: "0.7rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem" }}>Country Code</label>
          <input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} maxLength={2} style={{ ...inputStyle, width: 80 }} />
        </div>
        <Button onClick={create}>Block Country</Button>
      </div>
      {rows?.map((r) => (
        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--grid)" }}>
          <span>
            {r.countryCode} — {r.action}
          </span>
          <Button size="sm" variant="danger" onClick={() => remove(r.id)}>
            Delete
          </Button>
        </div>
      ))}
    </div>
  );
}

function IpBlocklistTab() {
  return (
    <div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
        IP/CIDR blocking reuses Intrusion Detection&apos;s existing blocklist — entries added there are synced to real Windows Firewall
        rules every minute by the WAF firewall sync job.
      </p>
      <Link href="/dashboard/security" style={{ color: "var(--accent)" }}>
        Manage IP Blocklist in Intrusion Detection →
      </Link>
    </div>
  );
}

function WafEventsTab() {
  const [data, setData] = useState<{ events: { Id: number; Category: string; Severity: string; SourceIp: string | null; RequestPath: string | null; CreatedAt: string }[]; activeBlocklistCount: number } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/security-center/waf/events");
      const json = await res.json();
      if (res.ok && json.ok) setData(json.data);
    })();
  }, []);

  if (!data) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div>
      <p style={{ fontSize: "0.85rem" }}>
        <strong>{data.activeBlocklistCount}</strong> IP(s) currently actively blocked.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
              <th style={{ padding: "0.4rem" }}>Time</th>
              <th style={{ padding: "0.4rem" }}>Category</th>
              <th style={{ padding: "0.4rem" }}>Source IP</th>
              <th style={{ padding: "0.4rem" }}>Path</th>
              <th style={{ padding: "0.4rem" }}>Severity</th>
            </tr>
          </thead>
          <tbody>
            {data.events.map((e) => (
              <tr key={e.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{new Date(e.CreatedAt).toLocaleString()}</td>
                <td style={{ padding: "0.4rem" }}>{e.Category}</td>
                <td style={{ padding: "0.4rem" }}>{e.SourceIp ?? "-"}</td>
                <td style={{ padding: "0.4rem" }}>{e.RequestPath ?? "-"}</td>
                <td style={{ padding: "0.4rem" }}>
                  <Badge tone={e.Severity === "critical" || e.Severity === "high" ? "danger" : e.Severity === "medium" ? "warning" : "neutral"}>{e.Severity}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WafInner() {
  const [tab, setTab] = useState<Tab>("Rate Limit Rules");

  return (
    <div>
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: tab === t ? "var(--primary)" : "var(--surface)",
              color: tab === t ? "#fff" : "var(--ink)",
              cursor: "pointer",
              fontSize: "0.82rem",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="dash-panel">
        {tab === "Rate Limit Rules" && <RateLimitRulesTab />}
        {tab === "Custom Rules" && <CustomRulesTab />}
        {tab === "Country Rules" && <CountryRulesTab />}
        {tab === "IP Blocklist" && <IpBlocklistTab />}
        {tab === "WAF Events" && <WafEventsTab />}
      </div>
    </div>
  );
}

export function WafClient() {
  return (
    <ToastProvider>
      <WafInner />
    </ToastProvider>
  );
}
