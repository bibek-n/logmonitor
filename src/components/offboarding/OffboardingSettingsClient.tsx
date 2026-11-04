"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};
const labelStyle: React.CSSProperties = { fontSize: "0.78rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.3rem" };

interface Settings {
  gitlabBaseUrl: string | null;
  gitlabTokenConfigured: boolean;
  glesysApiUser: string | null;
  glesysApiKeyConfigured: boolean;
  agentQaApiUrl: string | null;
  agentQaApiKeyConfigured: boolean;
  teamworkApiUrl: string | null;
  teamworkApiKeyConfigured: boolean;
  adBindDn: string | null;
  adBindPasswordConfigured: boolean;
}

function SettingsInner() {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [gitlabBaseUrl, setGitlabBaseUrl] = useState("");
  const [gitlabToken, setGitlabToken] = useState("");
  const [glesysApiUser, setGlesysApiUser] = useState("");
  const [glesysApiKey, setGlesysApiKey] = useState("");
  const [agentQaApiUrl, setAgentQaApiUrl] = useState("");
  const [agentQaApiKey, setAgentQaApiKey] = useState("");
  const [teamworkApiUrl, setTeamworkApiUrl] = useState("");
  const [teamworkApiKey, setTeamworkApiKey] = useState("");
  const [adBindDn, setAdBindDn] = useState("");
  const [adBindPassword, setAdBindPassword] = useState("");
  const [testDomain, setTestDomain] = useState("");
  const [testAdUsername, setTestAdUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingAd, setTestingAd] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/offboarding/settings");
      const data = await res.json();
      if (res.ok && data.ok) {
        setSettings(data.data);
        setGitlabBaseUrl(data.data.gitlabBaseUrl ?? "");
        setGlesysApiUser(data.data.glesysApiUser ?? "");
        setAgentQaApiUrl(data.data.agentQaApiUrl ?? "");
        setTeamworkApiUrl(data.data.teamworkApiUrl ?? "");
        setAdBindDn(data.data.adBindDn ?? "");
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, string> = { gitlabBaseUrl, glesysApiUser, agentQaApiUrl, teamworkApiUrl, adBindDn };
      if (gitlabToken.trim()) body.gitlabToken = gitlabToken.trim();
      if (glesysApiKey.trim()) body.glesysApiKey = glesysApiKey.trim();
      if (agentQaApiKey.trim()) body.agentQaApiKey = agentQaApiKey.trim();
      if (teamworkApiKey.trim()) body.teamworkApiKey = teamworkApiKey.trim();
      if (adBindPassword.trim()) body.adBindPassword = adBindPassword.trim();

      const res = await fetch("/api/admin/offboarding/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.show({ type: "error", message: data.error ?? "Save failed." });
        return;
      }
      toast.show({ type: "success", message: "Settings saved." });
      setGitlabToken("");
      setGlesysApiKey("");
      setAgentQaApiKey("");
      setTeamworkApiKey("");
      setAdBindPassword("");
      const refreshed = await (await fetch("/api/admin/offboarding/settings")).json();
      if (refreshed.ok) setSettings(refreshed.data);
    } finally {
      setSaving(false);
    }
  }

  async function testGlesys() {
    if (!testDomain.trim()) {
      toast.show({ type: "error", message: "Enter a domain to test against first." });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/admin/offboarding/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testGlesysDomain: testDomain.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.show({ type: "error", message: data.error ?? "Glesys test failed." });
        return;
      }
      toast.show({ type: "success", message: `Connected - found ${data.data.accountCount} mailbox(es) on ${testDomain.trim()}.` });
    } finally {
      setTesting(false);
    }
  }

  async function testActiveDirectory() {
    if (!testAdUsername.trim()) {
      toast.show({ type: "error", message: "Enter a real AD username (sAMAccountName) to test against first." });
      return;
    }
    setTestingAd(true);
    try {
      const res = await fetch("/api/admin/offboarding/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testAdUsername: testAdUsername.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.show({ type: "error", message: data.error ?? "AD test failed." });
        return;
      }
      toast.show({ type: "success", message: `Found "${testAdUsername.trim()}" - currently ${data.data.disabled ? "disabled" : "enabled"} in AD. (Read-only check, nothing was changed.)` });
    } finally {
      setTestingAd(false);
    }
  }

  if (!settings) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>GitLab Self-Managed</h3>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: 0 }}>
          Needs an administrator personal access token (api scope) - it&apos;s verified against your instance before being saved.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.7rem" }}>
          <div>
            <label style={labelStyle}>Base URL</label>
            <input value={gitlabBaseUrl} onChange={(e) => setGitlabBaseUrl(e.target.value)} placeholder="https://gitlab.yourcompany.com" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Administrator token {settings.gitlabTokenConfigured && <span style={{ color: "var(--success)" }}>(configured)</span>}</label>
            <input
              type="password"
              value={gitlabToken}
              onChange={(e) => setGitlabToken(e.target.value)}
              placeholder={settings.gitlabTokenConfigured ? "Leave blank to keep the current token" : "glpat-..."}
              style={inputStyle}
            />
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Glesys Email</h3>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: 0 }}>
          Glesys&apos;s documented email API has no dedicated mailbox-disable action, so offboarding resets the
          mailbox&apos;s password instead of suspending it - see the Offboarding dashboard for details.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.7rem" }}>
          <div>
            <label style={labelStyle}>API user</label>
            <input value={glesysApiUser} onChange={(e) => setGlesysApiUser(e.target.value)} placeholder="CL12345" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>API key {settings.glesysApiKeyConfigured && <span style={{ color: "var(--success)" }}>(configured)</span>}</label>
            <input
              type="password"
              value={glesysApiKey}
              onChange={(e) => setGlesysApiKey(e.target.value)}
              placeholder={settings.glesysApiKeyConfigured ? "Leave blank to keep the current key" : "API key"}
              style={inputStyle}
            />
          </div>
        </div>
        {settings.glesysApiKeyConfigured && (
          <div style={{ marginTop: "0.7rem", display: "flex", gap: "0.4rem", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Test domain</label>
              <input value={testDomain} onChange={(e) => setTestDomain(e.target.value)} placeholder="yourcompany.com" style={inputStyle} />
            </div>
            <Button size="sm" variant="secondary" onClick={testGlesys} disabled={testing}>
              {testing ? "Testing..." : "Test Connection"}
            </Button>
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>AgentQA (agentqa.lovable.app)</h3>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: 0 }}>
          Matches employees by Office Email automatically - no manual mapping needed unless an employee&apos;s AgentQA
          login uses a different email. There&apos;s no harmless test call for this API (every call actually enables
          or disables a real account), so this isn&apos;t test-checked here - the first real Disable All is the
          first real check.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.7rem" }}>
          <div>
            <label style={labelStyle}>API URL</label>
            <input value={agentQaApiUrl} onChange={(e) => setAgentQaApiUrl(e.target.value)} placeholder="https://....supabase.co/functions/v1/user-access-api" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>API key {settings.agentQaApiKeyConfigured && <span style={{ color: "var(--success)" }}>(configured)</span>}</label>
            <input
              type="password"
              value={agentQaApiKey}
              onChange={(e) => setAgentQaApiKey(e.target.value)}
              placeholder={settings.agentQaApiKeyConfigured ? "Leave blank to keep the current key" : "USER_ACCESS_API_KEY value"}
              style={inputStyle}
            />
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Teamwork (teamwork.websearchpro.net)</h3>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: 0 }}>
          Matches employees by email automatically, same as AgentQA. Built from a single example call rather than a
          full API doc. No harmless test call here (every call disables or re-enables a real account), so this
          isn&apos;t test-checked - the first real Disable All is the first real check.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.7rem" }}>
          <div>
            <label style={labelStyle}>API URL</label>
            <input value={teamworkApiUrl} onChange={(e) => setTeamworkApiUrl(e.target.value)} placeholder="https://....supabase.co/functions/v1/revoke-user-access" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>API key (Bearer token) {settings.teamworkApiKeyConfigured && <span style={{ color: "var(--success)" }}>(configured)</span>}</label>
            <input
              type="password"
              value={teamworkApiKey}
              onChange={(e) => setTeamworkApiKey(e.target.value)}
              placeholder={settings.teamworkApiKeyConfigured ? "Leave blank to keep the current key" : "TEAMWORK_USER_REMOVAL_API_KEY value"}
              style={inputStyle}
            />
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Active Directory (192.168.1.3, TulipsTech.com)</h3>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: 0 }}>
          Disables the employee&apos;s real Windows/VPN domain login - the most consequential system in this module.
          Requires an explicit AD username mapping per employee (no auto-match by email - see Map accounts). The
          server and base DN are shared with the existing AD Sync feature (AD_SERVER/AD_BASE_DN); only this
          write-scoped bind account is configured here. That account (svc-offboard) was delegated
          Write-Property on userAccountControl only, scoped to the real-employee OU - it cannot touch service
          accounts, privileged accounts, or domain controllers.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.7rem" }}>
          <div>
            <label style={labelStyle}>Bind DN</label>
            <input value={adBindDn} onChange={(e) => setAdBindDn(e.target.value)} placeholder="CN=svc-offboard,OU=Service-Accounts,DC=TulipsTech,DC=com" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Bind password {settings.adBindPasswordConfigured && <span style={{ color: "var(--success)" }}>(configured)</span>}</label>
            <input
              type="password"
              value={adBindPassword}
              onChange={(e) => setAdBindPassword(e.target.value)}
              placeholder={settings.adBindPasswordConfigured ? "Leave blank to keep the current password" : "Service account password"}
              style={inputStyle}
            />
          </div>
        </div>
        {settings.adBindPasswordConfigured && (
          <div style={{ marginTop: "0.7rem", display: "flex", gap: "0.4rem", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Test username (sAMAccountName)</label>
              <input value={testAdUsername} onChange={(e) => setTestAdUsername(e.target.value)} placeholder="e.g. bibek" style={inputStyle} />
            </div>
            <Button size="sm" variant="secondary" onClick={testActiveDirectory} disabled={testingAd}>
              {testingAd ? "Testing..." : "Test Connection"}
            </Button>
          </div>
        )}
      </Card>

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}

export function OffboardingSettingsClient() {
  return (
    <ToastProvider>
      <SettingsInner />
    </ToastProvider>
  );
}
