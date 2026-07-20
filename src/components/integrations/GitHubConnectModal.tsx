"use client";

import { useEffect, useState, FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.65rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};
const labelStyle: React.CSSProperties = { fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" };
const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "0.45rem 0.9rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: active ? "var(--primary)" : "var(--surface-2)",
  color: active ? "#fff" : "var(--ink)",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
});

interface ConfigStatus {
  pat: boolean;
  oauthApp: boolean;
  githubApp: boolean;
}

// Shared across every module's Add Project form (and the central Settings -> Integrations ->
// Git Connections page) - `returnTo` tells the OAuth/App flow which page to redirect back to
// once the connection is created, so a module never needs its own copy of this modal.
export function GitHubConnectModal({ open, onClose, onConnected, returnTo }: { open: boolean; onClose: () => void; onConnected: (connectionId: number) => void; returnTo: string }) {
  const toast = useToast();
  const [tab, setTab] = useState<"pat" | "oauth" | "app">("pat");
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    fetch("/api/admin/integrations/git/config-status")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setConfig(data.data);
      })
      .catch(() => {});
  }, [open]);

  async function handlePatSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/integrations/git/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "GitHub", name: name || "GitHub PAT", token }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to connect.");
      toast.show({ type: "success", message: `Connected GitHub account "${data.data.ownerLogin}".` });
      onConnected(data.data.id);
      setName("");
      setToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect.");
    } finally {
      setSaving(false);
    }
  }

  const oauthStartUrl = `/api/admin/integrations/git/github/oauth/start?returnTo=${encodeURIComponent(returnTo)}`;
  const appInstallUrl = `/api/admin/integrations/git/github/app/install?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <Modal open={open} onClose={onClose} title="Connect GitHub" size="md">
      <div className="flex flex-col" style={{ gap: "1rem" }}>
        <div className="flex gap-2">
          <button type="button" style={tabStyle(tab === "pat")} onClick={() => setTab("pat")}>Personal Access Token</button>
          <button type="button" style={tabStyle(tab === "oauth")} onClick={() => setTab("oauth")}>OAuth App</button>
          <button type="button" style={tabStyle(tab === "app")} onClick={() => setTab("app")}>GitHub App</button>
        </div>

        {error && <div style={{ padding: "0.6rem 0.8rem", borderRadius: 8, background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)", fontSize: "0.82rem" }}>{error}</div>}

        {tab === "pat" && (
          <form onSubmit={handlePatSubmit} className="flex flex-col gap-3">
            <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", margin: 0 }}>
              Paste a fine-grained GitHub Personal Access Token, scoped to only the repositories you want to scan (Repository permissions →
              Contents: Read-only is sufficient). The token is encrypted before it&apos;s stored and is never shown again after this.
            </p>
            <div>
              <label style={labelStyle}>Connection Name (optional)</label>
              <input style={fieldStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My GitHub Account" maxLength={200} />
            </div>
            <div>
              <label style={labelStyle}>Personal Access Token</label>
              <input style={{ ...fieldStyle, fontFamily: "monospace" }} type="password" value={token} onChange={(e) => setToken(e.target.value)} required placeholder="github_pat_..." />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={saving || !token.trim()}>{saving ? "Connecting…" : "Connect"}</Button>
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            </div>
          </form>
        )}

        {tab === "oauth" && (
          <div className="flex flex-col gap-3">
            {config === null ? (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>Checking configuration…</p>
            ) : config.oauthApp ? (
              <>
                <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", margin: 0 }}>
                  Sign in with GitHub and authorize access to your repositories. You&apos;ll be redirected back here once connected.
                </p>
                <a href={oauthStartUrl} style={{ alignSelf: "flex-start" }}>
                  <Button type="button">Connect with GitHub</Button>
                </a>
              </>
            ) : (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
                A GitHub OAuth App has not been configured on this server yet. Ask your administrator to create one at{" "}
                <span style={{ fontFamily: "monospace" }}>github.com/settings/developers</span> and set{" "}
                <span style={{ fontFamily: "monospace" }}>GITHUB_OAUTH_CLIENT_ID</span>, <span style={{ fontFamily: "monospace" }}>GITHUB_OAUTH_CLIENT_SECRET</span>, and{" "}
                <span style={{ fontFamily: "monospace" }}>GITHUB_OAUTH_REDIRECT_URI</span> in the server&apos;s environment.
              </p>
            )}
          </div>
        )}

        {tab === "app" && (
          <div className="flex flex-col gap-3">
            {config === null ? (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>Checking configuration…</p>
            ) : config.githubApp ? (
              <>
                <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", margin: 0 }}>
                  Install the GitHub App on your account or organization and choose exactly which repositories it can access - the most
                  scoped of the three connection methods.
                </p>
                <a href={appInstallUrl} style={{ alignSelf: "flex-start" }}>
                  <Button type="button">Install GitHub App</Button>
                </a>
              </>
            ) : (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
                A GitHub App has not been registered on this server yet. Ask your administrator to create one at{" "}
                <span style={{ fontFamily: "monospace" }}>github.com/settings/apps/new</span> (Repository permissions → Contents:
                Read-only) and set <span style={{ fontFamily: "monospace" }}>GITHUB_APP_ID</span>,{" "}
                <span style={{ fontFamily: "monospace" }}>GITHUB_APP_SLUG</span>, and <span style={{ fontFamily: "monospace" }}>GITHUB_APP_PRIVATE_KEY</span> in the
                server&apos;s environment.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
