"use client";

import { useState, FormEvent } from "react";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TulipsLogo } from "@/components/branding/TulipsLogo";
import "../login/login.css";

export default function ForgotPasswordPage() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail: value }),
      });
    } catch {
      // Shown the same generic confirmation regardless - nothing sensitive to report either
      // way, and retrying is always safe.
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

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
            <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--lp-ink)" }}>Forgot your password?</h1>
            <p style={{ fontSize: "0.85rem", color: "var(--lp-ink-muted)", margin: "0.35rem 0 0", textAlign: "center" }}>
              Enter your username or email and we&apos;ll send you a link to reset it.
            </p>
          </div>

          {submitted ? (
            <div className="login-alert login-alert-info">
              <CheckCircle2 size={16} />
              <span>If an account exists for that username or email, we&apos;ve sent a password reset link. Check your inbox (and spam folder).</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="login-field active">
                <span className="login-field-icon">
                  <Mail size={17} />
                </span>
                <input
                  id="usernameOrEmail"
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  autoComplete="username"
                  required
                  autoFocus
                  placeholder=" "
                />
                <label htmlFor="usernameOrEmail">Username or email</label>
              </div>
              <button className="login-btn-primary" type="submit" disabled={loading || !value.trim()}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </span>
                ) : (
                  "Send reset link"
                )}
              </button>
            </form>
          )}

          <Link
            href="/login"
            className="login-btn-ghost"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", textDecoration: "none" }}
          >
            <ArrowLeft size={14} />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
