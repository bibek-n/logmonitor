"use client";

import { Suspense, useState, useEffect, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter, useSearchParams } from "next/navigation";
import { TulipsLogo } from "@/components/branding/TulipsLogo";

const RESEND_COOLDOWN_SECONDS = 30;

function LoginForm() {
  const t = useTranslations("login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<"credentials" | "otp" | "totp">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldownUntil, setResendCooldownUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const idleLogout = searchParams.get("reason") === "idle";

  useEffect(() => {
    setPasskeySupported(typeof window !== "undefined" && !!window.PublicKeyCredential);
  }, []);

  async function handlePasskeySignIn() {
    setError(null);
    setInfo(null);
    setPasskeyLoading(true);
    try {
      const optionsRes = await fetch("/api/auth/passkey/auth-options", { method: "POST" });
      const optionsData = await optionsRes.json();
      if (!optionsData.ok) throw new Error(optionsData.error ?? t("errors.generic"));

      const assertion = await startAuthentication({ optionsJSON: optionsData.options });

      const result = await signIn("webauthn", { assertion: JSON.stringify(assertion), redirect: false });
      if (!result?.error) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setError(t("errors.invalidCredentials"));
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (!message.toLowerCase().includes("not allowed") && !message.toLowerCase().includes("cancel")) {
        setError(t("errors.generic"));
      }
    } finally {
      setPasskeyLoading(false);
    }
  }

  // "OTP_EXPIRED"/"OTP_LOCKED"/"OTP_INVALID"/"TOTP_INVALID"/"RECOVERY_INVALID" come from
  // /api/auth/verify-otp; any other string is passed through as-is (already a human-readable
  // message from that route or request-otp).
  function otpErrorMessage(error: string): string {
    switch (error) {
      case "OTP_INVALID":
        return t("errors.invalid");
      case "OTP_EXPIRED":
        return t("errors.expired");
      case "OTP_LOCKED":
        return t("errors.locked");
      case "TOTP_INVALID":
        return t("errors.totpInvalid");
      case "RECOVERY_INVALID":
        return t("errors.recoveryInvalid");
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

    setOtp("");
    setError(null);
    setUseRecoveryCode(false);

    if (data.method === "totp") {
      // Authenticator-app users skip the emailed-code step entirely — no email was sent,
      // so there's nothing to "resend" and no info banner about checking inbox.
      setStage("totp");
      setInfo(null);
    } else {
      setStage("otp");
      setInfo(t("infoMessage"));
      setResendCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    }
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

  async function submitOtp(codeToSubmit: string) {
    setError(null);
    setLoading(true);

    const mode = stage === "totp" && useRecoveryCode ? "recovery" : "totp";

    // Fast path: try the real sign-in immediately — one round trip, and it's what succeeds
    // on the overwhelming majority of attempts (a correct code). We only fall back to
    // verify-otp's dry-check *after* a failure, purely to recover a specific error message:
    // this app's IIS front end replaces any non-2xx response body with a generic error page,
    // which would otherwise swallow next-auth's real error detail. Previously this dry-check
    // ran unconditionally before every sign-in, doubling the round trips (and the perceived
    // lag) on every single successful login just to cover the failure case.
    const result = await signIn("credentials", {
      username, password, otp: codeToSubmit,
      totpMode: stage === "totp" ? mode : undefined,
      redirect: false,
    });

    if (!result?.error) {
      setLoading(false);
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const verifyRes = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, otp: codeToSubmit, mode }),
    });
    const verifyData = await verifyRes.json().catch(() => ({ ok: false, error: t("errors.generic") }));

    setLoading(false);
    setError(verifyData.ok ? t("errors.finalizeError") : otpErrorMessage(verifyData.error ?? t("errors.generic")));
  }

  function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    void submitOtp(otp);
  }

  // Auto-verify once all 6 digits are in, so the user doesn't have to click Verify — this
  // only fires once per distinct code: after a failed attempt the input still holds the same
  // (wrong) value, and since the effect's dependency (`otp`) hasn't changed, it won't
  // re-fire on its own — the user has to actually edit the code to try again, same as
  // clicking Verify a second time would have required them to notice and retry manually.
  // Recovery codes (XXXX-XXXX, 9 characters) don't auto-verify — their length varies less
  // predictably as the user types, so they always submit via the button.
  useEffect(() => {
    if ((stage === "otp" || (stage === "totp" && !useRecoveryCode)) && otp.length === 6 && !loading) {
      void submitOtp(otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, stage]);

  async function handleResend() {
    if (resendSecondsLeft > 0 || loading) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    await requestOtp();
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen">
      <div
        className="hidden lg:flex flex-col justify-between"
        style={{
          flex: "0 0 42%",
          padding: "3rem",
          background: "linear-gradient(135deg, var(--primary, #00c2ff), #0b1220)",
          color: "#fff",
        }}
      >
        <div>
          <div style={{ marginBottom: "1.5rem" }}>
            <TulipsLogo height={40} padded />
          </div>
          <h2 style={{ fontSize: "1.9rem", fontWeight: 800, lineHeight: 1.25, marginBottom: "1rem" }}>
            {t("heading")}
          </h2>
          <p style={{ fontSize: "1rem", lineHeight: 1.6, color: "rgba(255,255,255,0.85)", maxWidth: 400, marginBottom: "1.5rem" }}>
            {t("brandDescription")}
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[t("brandFeature1"), t("brandFeature2"), t("brandFeature3"), t("brandFeature4")].map((feature) => (
              <li key={feature} className="flex items-center gap-2" style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.9)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", flexShrink: 0 }} />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)" }}>
          &copy; {new Date().getFullYear()} Tulips Technologies
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center" style={{ padding: "1.5rem", background: "var(--bg, var(--surface-2))" }}>
        <div
          className="card"
          style={{
            maxWidth: 380,
            boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex flex-col items-center" style={{ marginBottom: "1.5rem" }}>
            <div style={{ marginBottom: "0.75rem" }}>
              <TulipsLogo height={38} padded />
            </div>
            <h1 style={{ margin: 0 }}>{t("heading")}</h1>
            <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: "0.35rem 0 0" }}>{t("brandSubtitle")}</p>
          </div>
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
            {passkeySupported && (
              <button
                type="button"
                className="submit"
                style={{ marginTop: "0.5rem", background: "transparent", border: "1px solid var(--border, #E2E8F0)", color: "var(--ink, #0F172A)" }}
                onClick={handlePasskeySignIn}
                disabled={passkeyLoading}
              >
                {passkeyLoading ? "Waiting for Face ID / Touch ID..." : "Sign in with Face ID / Touch ID"}
              </button>
            )}
          </form>
        ) : stage === "otp" ? (
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
        ) : (
          <form onSubmit={handleOtpSubmit}>
            <div className="field">
              <label htmlFor="totp">{useRecoveryCode ? t("recoveryCodeLabel") : t("totpLabel")}</label>
              {useRecoveryCode ? (
                <input
                  id="totp"
                  type="text"
                  autoComplete="one-time-code"
                  maxLength={9}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.toUpperCase())}
                  required
                  autoFocus
                  placeholder="XXXX-XXXX"
                />
              ) : (
                <input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
              )}
            </div>
            <button className="submit" type="submit" disabled={loading || otp.length === 0}>
              {loading ? t("verifying") : t("verify")}
            </button>
            <button
              type="button"
              className="submit"
              style={{ background: "transparent", color: "var(--ink-muted, #64748b)", marginTop: "0.5rem" }}
              onClick={() => {
                setUseRecoveryCode((prev) => !prev);
                setOtp("");
                setError(null);
              }}
              disabled={loading}
            >
              {useRecoveryCode ? t("useAuthenticatorInstead") : t("useRecoveryCodeInstead")}
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
                setUseRecoveryCode(false);
              }}
              disabled={loading}
            >
              {t("back")}
            </button>
          </form>
        )}
        </div>
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
