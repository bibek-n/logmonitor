"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CopyButton } from "@/components/ui/CopyButton";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface SshKey {
  id: number;
  name: string;
  keyType: string;
  publicKey: string;
  fingerprint: string;
  expiresAt: string | null;
  lastAccessedAt: string | null;
  createdAt: string;
}

const inputStyle = { padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem", width: "100%" };
const labelStyle = { display: "block", fontSize: "0.78rem", marginBottom: 4, color: "var(--ink-muted)" };

function SshKeysInner() {
  const toast = useToast();
  const [keys, setKeys] = useState<SshKey[] | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [genForm, setGenForm] = useState({ name: "", keyType: "Ed25519", passphrase: "" });
  const [importForm, setImportForm] = useState({ name: "", privateKey: "", passphrase: "" });
  const [busy, setBusy] = useState(false);

  const [revealTarget, setRevealTarget] = useState<SshKey | null>(null);
  const [revealPassword, setRevealPassword] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealBusy, setRevealBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/remote-access/ssh-keys");
    const data = await res.json();
    if (res.ok && data.ok) setKeys(data.data);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    if (!genForm.name.trim()) {
      toast.show({ type: "error", message: "Name is required." });
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/remote-access/ssh-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "generate", name: genForm.name, keyType: genForm.keyType, passphrase: genForm.passphrase || null }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Key generation failed." });
      return;
    }
    setGenOpen(false);
    setGenForm({ name: "", keyType: "Ed25519", passphrase: "" });
    toast.show({ type: "success", message: "SSH key pair generated." });
    await load();
  }

  async function doImport() {
    if (!importForm.name.trim() || !importForm.privateKey.trim()) {
      toast.show({ type: "error", message: "Name and private key are required." });
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/remote-access/ssh-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "import", name: importForm.name, privateKey: importForm.privateKey, passphrase: importForm.passphrase || null }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Key import failed." });
      return;
    }
    setImportOpen(false);
    setImportForm({ name: "", privateKey: "", passphrase: "" });
    toast.show({ type: "success", message: "SSH key imported." });
    await load();
  }

  async function remove(key: SshKey) {
    if (!confirm(`Delete SSH key "${key.name}"? Any connection referencing it will need a replacement.`)) return;
    await fetch(`/api/admin/remote-access/ssh-keys/${key.id}`, { method: "DELETE" });
    await load();
  }

  function openReveal(key: SshKey) {
    setRevealTarget(key);
    setRevealPassword("");
    setRevealedKey(null);
  }

  async function submitReveal() {
    if (!revealTarget) return;
    setRevealBusy(true);
    const res = await fetch(`/api/admin/remote-access/ssh-keys/${revealTarget.id}/reveal-private`, {
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
    setRevealedKey(data.data.privateKeyPem);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginBottom: "1rem" }}>
        <Button variant="secondary" onClick={() => setImportOpen(true)}>
          Import Key
        </Button>
        <Button onClick={() => setGenOpen(true)}>Generate Key</Button>
      </div>

      <div className="dash-panel">
        {keys === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : keys.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No SSH keys yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ padding: "0.4rem" }}>Name</th>
                <th style={{ padding: "0.4rem" }}>Type</th>
                <th style={{ padding: "0.4rem" }}>Fingerprint</th>
                <th style={{ padding: "0.4rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{k.name}</td>
                  <td style={{ padding: "0.4rem" }}>{k.keyType}</td>
                  <td style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.78rem" }}>{k.fingerprint}</td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                    <Button size="sm" variant="secondary" onClick={() => openReveal(k)}>
                      Reveal Private Key
                    </Button>{" "}
                    <Button size="sm" variant="danger" onClick={() => remove(k)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate SSH Key" size="sm" footer={<Button onClick={generate} disabled={busy}>{busy ? "Generating..." : "Generate"}</Button>}>
        <div style={{ display: "grid", gap: "0.7rem" }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={genForm.name} onChange={(e) => setGenForm({ ...genForm, name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Key Type</label>
            <select style={inputStyle} value={genForm.keyType} onChange={(e) => setGenForm({ ...genForm, keyType: e.target.value })}>
              <option value="Ed25519">Ed25519 (recommended)</option>
              <option value="Rsa">RSA 4096</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Passphrase (optional)</label>
            <input type="password" style={inputStyle} value={genForm.passphrase} onChange={(e) => setGenForm({ ...genForm, passphrase: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import SSH Key" size="md" footer={<Button onClick={doImport} disabled={busy}>{busy ? "Importing..." : "Import"}</Button>}>
        <div style={{ display: "grid", gap: "0.7rem" }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={importForm.name} onChange={(e) => setImportForm({ ...importForm, name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Private Key (PEM/OpenSSH format)</label>
            <textarea style={{ ...inputStyle, minHeight: 120, fontFamily: "monospace" }} value={importForm.privateKey} onChange={(e) => setImportForm({ ...importForm, privateKey: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Passphrase (if encrypted)</label>
            <input type="password" style={inputStyle} value={importForm.passphrase} onChange={(e) => setImportForm({ ...importForm, passphrase: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!revealTarget}
        onClose={() => setRevealTarget(null)}
        title={`Reveal Private Key — ${revealTarget?.name ?? ""}`}
        size="md"
        footer={
          revealedKey === null ? (
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
        {revealedKey === null ? (
          <div>
            <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>Re-enter your account password to reveal this private key. This action is audited.</p>
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
            <label style={labelStyle}>Private Key</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <textarea readOnly style={{ ...inputStyle, minHeight: 160, fontFamily: "monospace", fontSize: "0.75rem" }} value={revealedKey} onFocus={(e) => e.target.select()} />
              <CopyButton value={revealedKey} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function SshKeysClient() {
  return (
    <ToastProvider>
      <SshKeysInner />
    </ToastProvider>
  );
}
