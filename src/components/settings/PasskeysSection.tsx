"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface Passkey {
  id: number;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export function PasskeysSection() {
  const toast = useToast();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!window.PublicKeyCredential);
    loadPasskeys();
  }, []);

  async function loadPasskeys() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/passkey/list");
      const data = await res.json();
      if (data.ok) setPasskeys(data.passkeys);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPasskey() {
    setAdding(true);
    try {
      const optionsRes = await fetch("/api/auth/passkey/register-options", { method: "POST" });
      const optionsData = await optionsRes.json();
      if (!optionsData.ok) throw new Error(optionsData.error ?? "Failed to start passkey registration");

      const attestation = await startRegistration({ optionsJSON: optionsData.options });

      const label = window.navigator.platform || "This device";
      const verifyRes = await fetch("/api/auth/passkey/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attestation, deviceLabel: label }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.ok) throw new Error(verifyData.error ?? "Failed to save passkey");

      toast.show({ type: "success", message: "Passkey added — you can now log in with Face ID / Touch ID on this device." });
      await loadPasskeys();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add passkey";
      // A user cancelling the Face ID/Touch ID prompt throws a DOMException — not a real error.
      if (message.toLowerCase().includes("not allowed") || message.toLowerCase().includes("cancel")) {
        toast.show({ type: "error", message: "Cancelled." });
      } else {
        toast.show({ type: "error", message });
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch("/api/auth/passkey/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to remove passkey");
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
      toast.show({ type: "success", message: "Passkey removed." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to remove passkey" });
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>Passkeys (Face ID / Touch ID)</h2>
        <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginTop: "0.3rem" }}>
          Add this device as a passkey to sign in with Face ID or Touch ID — no username, password, or email code
          needed. Registering here uses your current session; the prompt for Face ID/Touch ID comes from the device
          itself.
        </p>
      </div>

      {!supported && (
        <p style={{ fontSize: "0.8rem", color: "var(--warning, #f59e0b)" }}>
          This browser doesn&apos;t support passkeys — try Safari on iPhone/iPad/Mac, or Chrome/Edge on a device with
          Windows Hello.
        </p>
      )}

      {loading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Loading...</p>
      ) : passkeys.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No passkeys registered yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {passkeys.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between"
              style={{ padding: "0.6rem 0.8rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.83rem" }}
            >
              <div>
                <div style={{ color: "var(--ink)", fontWeight: 500 }}>{p.deviceLabel ?? "Unnamed device"}</div>
                <div style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}>
                  Added {new Date(p.createdAt).toLocaleDateString()}
                  {p.lastUsedAt ? ` · Last used ${new Date(p.lastUsedAt).toLocaleDateString()}` : " · Never used"}
                </div>
              </div>
              <button
                onClick={() => handleDelete(p.id)}
                style={{ background: "none", border: "none", color: "var(--danger, #ef4444)", cursor: "pointer", fontSize: "0.8rem" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <Button onClick={handleAddPasskey} disabled={adding || !supported} style={{ alignSelf: "flex-start" }}>
        {adding ? "Adding..." : "Add a passkey for this device"}
      </Button>
    </Card>
  );
}
