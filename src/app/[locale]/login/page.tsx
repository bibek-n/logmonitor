"use client";

import { Suspense, useState, useEffect, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

const RESEND_COOLDOWN_SECONDS = 30;

function LoginForm() {
  const t = useTranslations("login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<"credentials" | "otp">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldownUntil, setResendCooldownUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const idleLogout = searchParams.get("reason") === "idle";

  // "OTP_EXPIRED"/"OTP_LOCKED"/"OTP_INVALID" come from /api/auth/verify-otp; any other string
  // is passed through as-is (already a human-readable message from that route or request-otp).
  function otpErrorMessage(error: string): string {
    switch (error) {
      case "OTP_INVALID":
        return t("errors.invalid");
      case "OTP_EXPIRED":
        return t("errors.expired");
      case "OTP_LOCKED":
        return t("errors.locked");
      default:
        return error;
    }
  }

  useEffect(() => {
    if (!resendCooldownUntil) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [resendCooldownUntil]);

  const resendSecondsLeft = resendCooldownUntil ? Math.max(0, Math.ceil((resendCooldownUntil - Date.now()) / 1000)) : 0;

  // Calls the plain-JSON, always-200 pre-check route rather than next-auth's signIn()
  // directly — this app's IIS front end replaces any non-2xx response body with a generic
  // error page, which would otherwise swallow next-auth's real JSON error payload. See
  // src/app/api/auth/request-otp/route.ts.
  async function requestOtp(): Promise<boolean> {
    const res = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: t("errors.generic") }));

    if (!data.ok) {
      setError(data.error ?? t("errors.invalidCredentials"));
      return false;
    }

    setStage("otp");
    setOtp("");
    setError(null);
    setInfo(t("infoMessage"));
    setResendCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    return true;
  }

  async function handleCredentialsSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    await requestOtp();
    setLoading(false);
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const verifyRes = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, otp }),
    });
    const verifyData = await verifyRes.json().catch(() => ({ ok: false, error: t("errors.generic") }));

    if (!verifyData.ok) {
      setLoading(false);
      setError(otpErrorMessage(verifyData.error ?? t("errors.generic")));
      return;
    }

    // Code is confirmed correct — this call now only needs to succeed, which commits the
    // OTP (clears it server-side) and issues the real session.
    const result = await signIn("credentials", { username, password, otp, redirect: false });

    setLoading(false);

    if (!result?.error) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setError(t("errors.finalizeError"));
  }

  async function handleResend() {
    if (resendSecondsLeft > 0 || loading) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    await requestOtp();
    setLoading(false);
  }

  return (
    <div className="center-screen">
      <div className="card">
        <h1>{t("heading")}</h1>
        {idleLogout && !error && (
          <div className="error" style={{ background: "var(--warning, #f59e0b)" }}>
            {t("idleLogoutMessage")}
          </div>
        )}
        {error && <div className="error">{error}</div>}
        {info && !error && (
          <div className="error" style={{ background: "var(--info, #06b6d4)" }}>
            {info}
          </div>
        )}

        {stage === "credentials" ? (
          <form onSubmit={handleCredentialsSubmit}>
            <div className="field">
              <label htmlFor="username">{t("usernameLabel")}</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">{t("passwordLabel")}</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="submit" type="submit" disabled={loading}>
              {loading ? t("signingIn") : t("signIn")}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit}>
            <div className="field">
              <label htmlFor="otp">{t("otpLabel")}</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
              />
            </div>
            <button className="submit" type="submit" disabled={loading || otp.length !== 6}>
              {loading ? t("verifying") : t("verify")}
            </button>
            <button
              type="button"
              className="submit"
              style={{ background: "transparent", color: "var(--ink-muted, #64748b)", marginTop: "0.5rem" }}
              onClick={handleResend}
              disabled={loading || resendSecondsLeft > 0}
            >
              {resendSecondsLeft > 0 ? t("resendCodeWithSeconds", { seconds: resendSecondsLeft }) : t("resendCode")}
            </button>
            <button
              type="button"
              className="submit"
              style={{ background: "transparent", color: "var(--ink-muted, #64748b)" }}
              onClick={() => {
                setStage("credentials");
                setOtp("");
                setError(null);
                setInfo(null);
              }}
              disabled={loading}
            >
              {t("back")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
