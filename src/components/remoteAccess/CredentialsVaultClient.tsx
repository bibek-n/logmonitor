"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { CopyButton } from "@/components/ui/CopyButton";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface Credential {
  id: number;
  name: string;
  credentialType: string;
  username: string | null;
  domain: string | null;
  expiresAt: string | null;
  lastRotatedAt: string | null;
  rotationReminderDays: number | null;
  lastAccessedAt: string | null;
  createdAt: string;
}

const CREDENTIAL_TYPES = ["UsernamePassword", "WindowsDomain", "SshKeyPassphrase", "Rdp", "Ftp", "ApiToken", "Certificate", "Database", "Custom"];
const inputStyle = { padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem", width: "100%" };
const labelStyle = { display: "block", fontSize: "0.78rem", marginBottom: 4, color: "var(--ink-muted)" };

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const days = (new Date(expiresAt).getTime() - Date.now()) / 86400000;
  return days < 14;
}

// Rotation due date is (LastRotatedAt ?? CreatedAt) + RotationReminderDays - a credential with no
// RotationReminderDays configured never shows a rotation badge (opt-in per credential).
function rotationDueDate(cred: Credential): Date | null {
  if (!cred.rotationReminderDays) return null;
  const base = new Date(cred.lastRotatedAt ?? cred.createdAt).getTime();
  return new Date(base + cred.rotationReminderDays * 86400000);
}
function isRotationDue(cred: Credential): boolean {
  const due = rotationDueDate(cred);
  return due !== null && due.getTime() <= Date.now();
}

function CredentialsVaultInner() {
  const toast = useToast();
  const [creds, setCreds] = useState<Credential[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", credentialType: "UsernamePassword", secret: "", username: "", domain: "", expiresAt: "" });

  const [revealTarget, setRevealTarget] = useState<Credential | null>(null);
  const [revealPassword, setRevealPassword] = useState("");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [revealBusy, setRevealBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/remote-access/credentials");
    const data = await res.json();
    if (res.ok && data.ok) setCreds(data.data);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function createCredential() {
    if (!form.name.trim() || !form.secret.trim()) {
      toast.show({ type: "error", message: "Name and secret are required." });
      return;
    }
    const res = await fetch("/api/admin/remote-access/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        credentialType: form.credentialType,
        secret: form.secret,
        username: form.username || null,
        domain: form.domain || null,
        expiresAt: form.expiresAt || null,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to create credential." });
      return;
    }
    setCreateOpen(false);
    setForm({ name: "", credentialType: "UsernamePassword", secret: "", username: "", domain: "", expiresAt: "" });
    await load();
  }

  async function remove(cred: Credential) {
    if (!confirm(`Delete credential "${cred.name}"? Any connection referencing it will need a replacement.`)) return;
    await fetch(`/api/admin/remote-access/credentials/${cred.id}`, { method: "DELETE" });
    await load();
  }

  async function markRotated(cred: Credential) {
    if (!confirm(`Mark "${cred.name}" as rotated? This resets its rotation-due date without changing the stored secret.`)) return;
    await fetch(`/api/admin/remote-access/credentials/${cred.id}/rotate`, { method: "POST" });
    toast.show({ type: "success", message: "Rotation date updated." });
    await load();
  }

  function openReveal(cred: Credential) {
    setRevealTarget(cred);
    setRevealPassword("");
    setRevealedSecret(null);
  }

  async function submitReveal() {
    if (!revealTarget) return;
    setRevealBusy(true);
    const res = await fetch(`/api/admin/remote-access/credentials/${revealTarget.id}/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: revealPassword }),
    });
    const data = await res.json();
    setRevealBusy(false);
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Re-authentication failed." });
      return;
    }
    setRevealedSecret(data.data.secret);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
        <Button onClick={() => setCreateOpen(true)}>Add Credential</Button>
      </div>

      <div className="dash-panel">
        {creds === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : creds.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No credentials stored yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ padding: "0.4rem" }}>Name</th>
                <th style={{ padding: "0.4rem" }}>Type</th>
                <th style={{ padding: "0.4rem" }}>Username</th>
                <th style={{ padding: "0.4rem" }}>Expires</th>
                <th style={{ padding: "0.4rem" }}>Rotation</th>
                <th style={{ padding: "0.4rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {creds.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{c.name}</td>
                  <td style={{ padding: "0.4rem" }}>
                    <Badge tone="neutral">{c.credentialType}</Badge>
                  </td>
                  <td style={{ padding: "0.4rem" }}>{c.username ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>
                    {c.expiresAt ? (
                      <Badge tone={isExpiringSoon(c.expiresAt) ? "warning" : "neutral"}>{new Date(c.expiresAt).toLocaleDateString()}</Badge>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={{ padding: "0.4rem" }}>
                    {rotationDueDate(c) ? <Badge tone={isRotationDue(c) ? "warning" : "neutral"}>{isRotationDue(c) ? "Due" : rotationDueDate(c)!.toLocaleDateString()}</Badge> : "-"}
                  </td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                    <Button size="sm" variant="secondary" onClick={() => openReveal(c)}>
                      Reveal
                    </Button>{" "}
                    {isRotationDue(c) && (
                      <Button size="sm" variant="secondary" onClick={() => markRotated(c)}>
                        Mark Rotated
                      </Button>
                    )}{" "}
                    <Button size="sm" variant="danger" onClick={() => remove(c)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Credential" size="md" footer={<Button onClick={createCredential}>Save</Button>}>
        <div style={{ display: "grid", gap: "0.7rem" }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select style={inputStyle} value={form.credentialType} onChange={(e) => setForm({ ...form, credentialType: e.target.value })}>
              {CREDENTIAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Username</label>
            <input style={inputStyle} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Secret (password / token / key material)</label>
            <textarea style={{ ...inputStyle, minHeight: 80, fontFamily: "monospace" }} value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Expires At (optional)</label>
            <input type="date" style={inputStyle} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!revealTarget}
        onClose={() => setRevealTarget(null)}
        title={`Reveal Secret — ${revealTarget?.name ?? ""}`}
        size="sm"
        footer={
          revealedSecret === null ? (
            <Button onClick={submitReveal} disabled={revealBusy || !revealPassword}>
              {revealBusy ? "Verifying..." : "Confirm"}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setRevealTarget(null)}>
              Done
            </Button>
          )
        }
      >
        {revealedSecret === null ? (
          <div>
            <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>Re-enter your account password to reveal this secret. This action is audited.</p>
            <label style={labelStyle}>Your Password</label>
            <input
              type="password"
              style={inputStyle}
              value={revealPassword}
              onChange={(e) => setRevealPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitReveal()}
              autoFocus
            />
          </div>
        ) : (
          <div>
            <label style={labelStyle}>Secret</label>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <input readOnly style={{ ...inputStyle, fontFamily: "monospace" }} value={revealedSecret} onFocus={(e) => e.target.select()} />
              <CopyButton value={revealedSecret} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function CredentialsVaultClient() {
  return (
    <ToastProvider>
      <CredentialsVaultInner />
    </ToastProvider>
  );
}
