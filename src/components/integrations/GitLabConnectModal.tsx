"use client";

import { useState, FormEvent } from "react";
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

export function GitLabConnectModal({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: (connectionId: number) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/integrations/git/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "GitLab", name: name || "GitLab Server", instanceUrl, token }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to connect.");
      toast.show({ type: "success", message: `Connected GitLab account "${data.data.ownerLogin}".` });
      onConnected(data.data.id);
      setName("");
      setInstanceUrl("");
      setToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Connect GitLab" size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", margin: 0 }}>
          Connect a self-hosted GitLab server using a Personal or Project Access Token scoped to <code>read_repository</code>. The
          token is encrypted before it&apos;s stored and is never shown again after this.
        </p>

        {error && <div style={{ padding: "0.6rem 0.8rem", borderRadius: 8, background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)", fontSize: "0.82rem" }}>{error}</div>}

        <div>
          <label style={labelStyle}>Connection Name (optional)</label>
          <input style={fieldStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Internal GitLab" maxLength={200} />
        </div>
        <div>
          <label style={labelStyle}>GitLab Instance URL</label>
          <input style={fieldStyle} value={instanceUrl} onChange={(e) => setInstanceUrl(e.target.value)} required placeholder="https://gitlab.example.com" />
        </div>
        <div>
          <label style={labelStyle}>Personal / Project Access Token</label>
          <input style={{ ...fieldStyle, fontFamily: "monospace" }} type="password" value={token} onChange={(e) => setToken(e.target.value)} required placeholder="glpat-..." />
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving || !token.trim() || !instanceUrl.trim()}>{saving ? "Connecting…" : "Connect"}</Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
