"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { CopyButton } from "@/components/ui/CopyButton";
import { useToast } from "@/components/ui/Toast";

const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" };

interface SetupData {
  secret: string;
  qrDataUrl: string;
}

export function TotpSection() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null);

  const [settingUp, setSettingUp] = useState(false);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [confirming, setConfirming] = useState(false);

  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const [disabling, setDisabling] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableSubmitting, setDisableSubmitting] = useState(false);

  const [regenerating, setRegenerating] = useState(false);
  const [regeneratePassword, setRegeneratePassword] = useState("");
  const [regenerateSubmitting, setRegenerateSubmitting] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/account/totp/status");
      const data = await res.json();
      if (data.ok) {
        setEnabled(data.enabled);
        setEnrolledAt(data.enrolledAt);
      }
    } finally {
      setLoading(false);
    }
  }

  async function startSetup() {
    setSettingUp(true);
    setConfirmCode("");
    try {
      const res = await fetch("/api/account/totp/setup", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to start setup.");
      setSetupData({ secret: data.secret, qrDataUrl: data.qrDataUrl });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to start setup." });
      setSettingUp(false);
    }
  }

  async function confirmSetup() {
    if (!setupData || confirmCode.length !== 6) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/account/totp/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: setupData.secret, code: confirmCode }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "That code didn't match.");
      setRecoveryCodes(data.recoveryCodes);
      setSettingUp(false);
      setSetupData(null);
      setEnabled(true);
      setEnrolledAt(new Date().toISOString());
      toast.show({ type: "success", message: "Authenticator app enabled." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "That code didn't match." });
    } finally {
      setConfirming(false);
    }
  }

  async function submitDisable() {
    if (!disablePassword) return;
    setDisableSubmitting(true);
    try {
      const res = await fetch("/api/account/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to disable.");
      setEnabled(false);
      setEnrolledAt(null);
      setDisabling(false);
      setDisablePassword("");
      toast.show({ type: "success", message: "Authenticator app disabled — logins will use the emailed code again." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to disable." });
    } finally {
      setDisableSubmitting(false);
    }
  }

  async function submitRegenerate() {
    if (!regeneratePassword) return;
    setRegenerateSubmitting(true);
    try {
      const res = await fetch("/api/account/totp/recovery-codes/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: regeneratePassword }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to regenerate.");
      setRegenerating(false);
      setRegeneratePassword("");
      setRecoveryCodes(data.recoveryCodes);
      toast.show({ type: "success", message: "Recovery codes regenerated — the old ones no longer work." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to regenerate." });
    } finally {
      setRegenerateSubmitting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>Authenticator App (QR Code)</h2>
        <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginTop: "0.3rem" }}>
          Scan a QR code with Google Authenticator or Microsoft Authenticator, then use the app&apos;s 6-digit code to
          sign in instead of the emailed code. Once enabled, login goes straight to the app code — no email round-trip.
        </p>
      </div>

      {loading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Loading...</p>
      ) : enabled ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge tone="success">Enabled</Badge>
            {enrolledAt && (
              <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
                Since {new Date(enrolledAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setRegenerating(true)} style={{ alignSelf: "flex-start" }}>
              Regenerate recovery codes
            </Button>
            <Button variant="danger" onClick={() => setDisabling(true)} style={{ alignSelf: "flex-start" }}>
              Disable
            </Button>
          </div>
        </div>
      ) : settingUp ? (
        <div className="flex flex-col gap-3">
          {!setupData ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Generating QR code...</p>
          ) : (
          <>
          <div className="flex items-center gap-4" style={{ flexWrap: "wrap" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setupData.qrDataUrl} alt="Authenticator app QR code" width={180} height={180} style={{ borderRadius: 8, border: "1px solid var(--border)" }} />
            <div className="flex flex-col gap-2" style={{ maxWidth: 260 }}>
              <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", margin: 0 }}>
                Can&apos;t scan? Enter this key manually in your authenticator app:
              </p>
              <code style={{ fontSize: "0.78rem", background: "var(--surface-2)", padding: "0.4rem 0.6rem", borderRadius: 6, wordBreak: "break-all" }}>
                {setupData.secret}
              </code>
              <CopyButton value={setupData.secret} label="Copy key" />
            </div>
          </div>
          <div style={{ maxWidth: 200 }}>
            <label style={{ fontSize: "0.8rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 }}>
              Enter the 6-digit code from the app to confirm
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
              style={inputStyle}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={confirmSetup} disabled={confirming || confirmCode.length !== 6}>
              {confirming ? "Confirming..." : "Confirm & Enable"}
            </Button>
            <Button variant="secondary" onClick={() => { setSettingUp(false); setSetupData(null); }} disabled={confirming}>
              Cancel
            </Button>
          </div>
          </>
          )}
        </div>
      ) : (
        <Button onClick={startSetup} style={{ alignSelf: "flex-start" }}>
          Set up authenticator app
        </Button>
      )}

      {/* One-time recovery codes display — shown right after enrollment or a regenerate,
          never retrievable again afterward. */}
      <Modal
        open={!!recoveryCodes}
        onClose={() => setRecoveryCodes(null)}
        title="Save your recovery codes"
        footer={<Button onClick={() => setRecoveryCodes(null)}>Done — I&apos;ve saved these</Button>}
      >
        <div className="flex flex-col gap-3">
          <p style={{ fontSize: "0.85rem", color: "var(--ink-secondary)", margin: 0 }}>
            Each code can be used once to sign in if you lose access to your authenticator app. Save them somewhere
            safe — they won&apos;t be shown again.
          </p>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: "repeat(2, 1fr)", background: "var(--surface-2)", padding: "0.75rem", borderRadius: 8, fontFamily: "monospace", fontSize: "0.85rem" }}
          >
            {recoveryCodes?.map((code) => <div key={code}>{code}</div>)}
          </div>
          {recoveryCodes && <CopyButton value={recoveryCodes.join("\n")} label="Copy all codes" />}
        </div>
      </Modal>

      <Modal
        open={disabling}
        onClose={() => { setDisabling(false); setDisablePassword(""); }}
        title="Disable authenticator app"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDisabling(false); setDisablePassword(""); }} disabled={disableSubmitting}>Cancel</Button>
            <Button variant="danger" onClick={submitDisable} disabled={disableSubmitting || !disablePassword}>
              {disableSubmitting ? "Disabling..." : "Disable"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <p style={{ fontSize: "0.85rem", color: "var(--ink-secondary)", margin: 0 }}>
            Confirm your current password to disable the authenticator app. Logins will go back to using the emailed
            code.
          </p>
          <input type="password" autoFocus value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} style={inputStyle} placeholder="Current password" />
        </div>
      </Modal>

      <Modal
        open={regenerating}
        onClose={() => { setRegenerating(false); setRegeneratePassword(""); }}
        title="Regenerate recovery codes"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setRegenerating(false); setRegeneratePassword(""); }} disabled={regenerateSubmitting}>Cancel</Button>
            <Button onClick={submitRegenerate} disabled={regenerateSubmitting || !regeneratePassword}>
              {regenerateSubmitting ? "Regenerating..." : "Regenerate"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <p style={{ fontSize: "0.85rem", color: "var(--ink-secondary)", margin: 0 }}>
            Confirm your current password. Your existing recovery codes will stop working immediately.
          </p>
          <input type="password" autoFocus value={regeneratePassword} onChange={(e) => setRegeneratePassword(e.target.value)} style={inputStyle} placeholder="Current password" />
        </div>
      </Modal>
    </Card>
  );
}
