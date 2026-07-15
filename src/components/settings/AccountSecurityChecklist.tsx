"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

interface SecurityProfile {
  mfaRequired: boolean;
  passwordChangedAt: string | null;
  recoveryPhone: string | null;
  recoveryEmail: string | null;
  skipPasswordWhenPossible: boolean;
  passkeyCount: number;
}

// Google-Account-style "security checkup" list for the currently signed-in user's own
// account - distinct from SecuritySection (org-wide policy) and PasskeysSection (its own
// add/remove UI, linked to below rather than duplicated here). mfaRequired and
// skipPasswordWhenPossible are stored preferences only, same status as the pre-existing
// MfaRequired column - they aren't wired into the login flow yet, so toggling them here
// records intent without yet changing sign-in behavior.
function Row({
  label,
  value,
  onClick,
  children,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        padding: "0.75rem 0",
        borderBottom: "1px solid var(--border)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div>
        <div style={{ fontSize: "0.88rem", color: "var(--ink)", fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: "0.15rem" }}>{value}</div>
      </div>
      {children}
    </div>
  );
}

export function AccountSecurityChecklist() {
  const toast = useToast();
  const [profile, setProfile] = useState<SecurityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingMfaOff, setConfirmingMfaOff] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await fetch("/api/account/security");
      const data = await res.json();
      if (data.ok) setProfile(data);
    } finally {
      setLoading(false);
    }
  }

  async function patch(body: Record<string, unknown>, field: string) {
    setSavingField(field);
    try {
      const res = await fetch("/api/account/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to save");
      await loadProfile();
      toast.show({ type: "success", message: "Updated." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSavingField(null);
    }
  }

  async function toggleMfa(next: boolean) {
    if (!next) {
      setConfirmingMfaOff(true);
      return;
    }
    await patch({ mfaRequired: true }, "mfa");
  }

  async function confirmMfaOff() {
    setConfirmingMfaOff(false);
    await patch({ mfaRequired: false }, "mfa");
  }

  async function saveRecoveryPhone() {
    await patch({ recoveryPhone: phoneDraft }, "phone");
    setEditingPhone(false);
  }

  async function saveRecoveryEmail() {
    await patch({ recoveryEmail: emailDraft }, "email");
    setEditingEmail(false);
  }

  async function submitPasswordChange() {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation don't match.");
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to change password");
      toast.show({ type: "success", message: "Password changed." });
      setChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await loadProfile();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  }

  function scrollToPasskeys() {
    document.getElementById("passkeys-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading || !profile) {
    return (
      <Card>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Loading account security...</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-1">
      <div style={{ marginBottom: "0.5rem" }}>
        <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>Your account security</h2>
        <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginTop: "0.3rem" }}>
          Settings for the account you're currently signed in as.
        </p>
      </div>

      <Row label="2-Step Verification" value={profile.mfaRequired ? "2-Step Verification is on" : "2-Step Verification is off"}>
        <Button
          variant={profile.mfaRequired ? "secondary" : "primary"}
          size="sm"
          disabled={savingField === "mfa"}
          onClick={() => toggleMfa(!profile.mfaRequired)}
        >
          {savingField === "mfa" ? "Saving..." : profile.mfaRequired ? "Turn off" : "Turn on"}
        </Button>
      </Row>

      <Row
        label="Passkeys and security keys"
        value={profile.passkeyCount === 0 ? "No passkeys" : `${profile.passkeyCount} passkey${profile.passkeyCount === 1 ? "" : "s"}`}
        onClick={scrollToPasskeys}
      />

      {changingPassword ? (
        <div style={{ padding: "0.75rem 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.88rem", color: "var(--ink)", fontWeight: 500, marginBottom: "0.6rem" }}>Change password</div>
          <div className="flex flex-col gap-2" style={{ maxWidth: 320 }}>
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{ padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem" }}
            />
            <input
              type="password"
              placeholder="New password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem" }}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem" }}
            />
            {passwordError && <div style={{ color: "var(--danger)", fontSize: "0.78rem" }}>{passwordError}</div>}
            <div className="flex gap-2">
              <Button size="sm" onClick={submitPasswordChange} disabled={passwordSaving}>
                {passwordSaving ? "Saving..." : "Save password"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setChangingPassword(false);
                  setPasswordError(null);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                disabled={passwordSaving}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Row
          label="Password"
          value={profile.passwordChangedAt ? `Last changed ${new Date(profile.passwordChangedAt).toLocaleDateString()}` : "Never changed"}
          onClick={() => setChangingPassword(true)}
        />
      )}

      <Row label="Skip password when possible" value={profile.skipPasswordWhenPossible ? "On" : "Off"}>
        <Button
          variant={profile.skipPasswordWhenPossible ? "secondary" : "primary"}
          size="sm"
          disabled={savingField === "skip"}
          onClick={() => patch({ skipPasswordWhenPossible: !profile.skipPasswordWhenPossible }, "skip")}
        >
          {savingField === "skip" ? "Saving..." : profile.skipPasswordWhenPossible ? "Turn off" : "Turn on"}
        </Button>
      </Row>

      {editingPhone ? (
        <div style={{ padding: "0.75rem 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.88rem", color: "var(--ink)", fontWeight: 500, marginBottom: "0.5rem" }}>Recovery phone</div>
          <div className="flex gap-2" style={{ maxWidth: 320 }}>
            <input
              type="tel"
              placeholder="Mobile phone number"
              value={phoneDraft}
              onChange={(e) => setPhoneDraft(e.target.value)}
              style={{ flex: 1, padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem" }}
            />
            <Button size="sm" onClick={saveRecoveryPhone} disabled={savingField === "phone"}>
              {savingField === "phone" ? "Saving..." : "Save"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditingPhone(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Row
          label="Recovery phone"
          value={profile.recoveryPhone ?? "Add a mobile phone number"}
          onClick={() => {
            setPhoneDraft(profile.recoveryPhone ?? "");
            setEditingPhone(true);
          }}
        />
      )}

      {editingEmail ? (
        <div style={{ padding: "0.75rem 0" }}>
          <div style={{ fontSize: "0.88rem", color: "var(--ink)", fontWeight: 500, marginBottom: "0.5rem" }}>Recovery email</div>
          <div className="flex gap-2" style={{ maxWidth: 320 }}>
            <input
              type="email"
              placeholder="Email address"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              style={{ flex: 1, padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem" }}
            />
            <Button size="sm" onClick={saveRecoveryEmail} disabled={savingField === "email"}>
              {savingField === "email" ? "Saving..." : "Save"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditingEmail(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Row
          label="Recovery email"
          value={profile.recoveryEmail ?? "Add an email address"}
          onClick={() => {
            setEmailDraft(profile.recoveryEmail ?? "");
            setEditingEmail(true);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmingMfaOff}
        onClose={() => setConfirmingMfaOff(false)}
        onConfirm={confirmMfaOff}
        title="Turn off 2-Step Verification?"
        message="This makes your account easier to sign into but less protected against someone else with your password."
        confirmLabel="Turn off"
        tone="danger"
        loading={savingField === "mfa"}
      />
    </Card>
  );
}
