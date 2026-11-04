"use client";

import { Suspense, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TulipsLogo } from "@/components/branding/TulipsLogo";
import "../login/login.css";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "Something went wrong. Please try again." }));
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="login-alert login-alert-error">
        <AlertCircle size={16} />
        <span>This reset link is missing its token. Request a new one from the sign-in page.</span>
      </div>
    );
  }

  if (done) {
    return (
      <>
        <div className="login-alert login-alert-info">
          <CheckCircle2 size={16} />
          <span>Your password has been updated.</span>
        </div>
        <Link
          href="/login"
          className="login-btn-primary"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
        >
          Go to sign in
        </Link>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="login-alert login-alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      <div className="login-field active">
        <span className="login-field-icon">
          <Lock size={17} />
        </span>
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          autoFocus
          placeholder=" "
        />
        <label htmlFor="password">New password</label>
        <span className="login-field-right">
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "inherit" }}
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </div>
      <div className="login-field active">
        <span className="login-field-icon">
          <Lock size={17} />
        </span>
        <input
          id="confirm"
          type={showPassword ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          placeholder=" "
        />
        <label htmlFor="confirm">Confirm new password</label>
      </div>
      <button className="login-btn-primary" type="submit" disabled={loading}>
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            Updating...
          </span>
        ) : (
          "Update password"
        )}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="login-page">
      <div className="login-bg" aria-hidden="true">
        <div className="login-orb login-orb-a" />
        <div className="login-orb login-orb-b" />
        <div className="login-orb login-orb-c" />
      </div>
      <div className="login-center">
        <div className="login-card" style={{ maxWidth: 380 }}>
          <div className="flex flex-col items-center" style={{ marginBottom: "1.5rem" }}>
            <div style={{ marginBottom: "0.85rem" }}>
              <TulipsLogo height={38} padded />
            </div>
            <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--lp-ink)" }}>Set a new password</h1>
          </div>
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
