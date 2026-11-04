"use client";

import { Suspense, useState, useEffect, useRef, FormEvent, ChangeEvent, KeyboardEvent, ClipboardEvent } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { startAuthentication } from "@simplewebauthn/browser";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Fingerprint,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  Info,
  ArrowLeft,
  Loader2,
  BookOpen,
  MessageCircle,
} from "lucide-react";
import { TulipsLogo } from "@/components/branding/TulipsLogo";
import { Link } from "@/i18n/navigation";
import "./login.css";

const RESEND_COOLDOWN_SECONDS = 30;
const OTP_LENGTH = 6;

// A small original flat-style mascot standing beside the card - not a copy of any stock
// illustration, just an homage to the "character leaning on the form" look of the reference
// design this page was asked to match.
function LoginMascot() {
  return (
    <svg width="132" height="212" viewBox="0 0 132 212" fill="none" aria-hidden="true">
      <ellipse cx="66" cy="204" rx="38" ry="7" fill="rgba(0,0,0,0.18)" />
      <rect x="42" y="134" width="18" height="60" rx="9" fill="#1e293b" />
      <rect x="72" y="134" width="18" height="60" rx="9" fill="#1e293b" />
      <rect x="37" y="186" width="28" height="14" rx="7" fill="#f97316" />
      <rect x="67" y="186" width="28" height="14" rx="7" fill="#f97316" />
      <rect x="33" y="72" width="66" height="70" rx="22" fill="#14b8a6" />
      <rect x="28" y="88" width="58" height="15" rx="7.5" fill="#0d9488" transform="rotate(-14 57 95)" />
      <rect x="46" y="88" width="58" height="15" rx="7.5" fill="#0d9488" transform="rotate(14 75 95)" />
      <rect x="58" y="58" width="16" height="18" fill="#f3b991" />
      <circle cx="66" cy="42" r="26" fill="#f3b991" />
      <path d="M40 38c2-16 15-26 26-26s24 10 26 26c-6-6-16-10-26-10s-20 4-26 10Z" fill="#2d1b0e" />
      <circle cx="58" cy="44" r="2.2" fill="#2d1b0e" />
      <circle cx="74" cy="44" r="2.2" fill="#2d1b0e" />
      <path d="M59 52c3 2.5 11 2.5 14 0" stroke="#2d1b0e" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// Mouse-tracked 3D tilt wrapper around the sign-in card. Disabled entirely under
// prefers-reduced-motion so it never fights a user's OS-level motion preference.
function TiltCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 200, damping: 25 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 200, damping: 25 });

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <div style={{ perspective: 1600 }}>
      <motion.div
        ref={ref}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{ rotateX: reduced ? 0 : rotateX, rotateY: reduced ? 0 : rotateY, transformStyle: "preserve-3d" }}
        className="login-card"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}

function FloatingInput({
  id,
  label,
  icon,
  type = "text",
  value,
  onChange,
  autoComplete,
  required,
  autoFocus,
  maxLength,
  rightSlot,
  inputStyle,
  placeholderWhenActive,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  type?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  required?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  rightSlot?: React.ReactNode;
  inputStyle?: React.CSSProperties;
  placeholderWhenActive?: string;
}) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;
  return (
    <div className={`login-field${active ? " active" : ""}`}>
      <span className="login-field-icon">{icon}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        required={required}
        autoFocus={autoFocus}
        maxLength={maxLength}
        placeholder={active ? placeholderWhenActive ?? "" : ""}
        style={inputStyle}
      />
      <label htmlFor={id}>{label}</label>
      {rightSlot && <span className="login-field-right">{rightSlot}</span>}
    </div>
  );
}

// Six (or N) individually-focusable digit boxes backing a single string value - paste and
// type-ahead both fan out across boxes so a pasted/autofilled code lands in one action.
function OtpBoxes({
  idPrefix,
  value,
  onChange,
  length = OTP_LENGTH,
  disabled,
  autoFocus,
}: {
  idPrefix: string;
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(i: number, digit: string) {
    const chars = value.split("");
    while (chars.length < length) chars.push("");
    chars[i] = digit;
    onChange(chars.join("").slice(0, length));
  }

  function fanOut(startIndex: number, text: string) {
    const digits = text.replace(/\D/g, "").slice(0, length - startIndex).split("");
    if (digits.length === 0) return;
    const next = value.split("");
    while (next.length < length) next.push("");
    digits.forEach((c, idx) => {
      next[startIndex + idx] = c;
    });
    onChange(next.join("").slice(0, length));
    refs.current[Math.min(startIndex + digits.length, length - 1)]?.focus();
  }

  function handleChange(i: number, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setDigit(i, "");
      return;
    }
    if (raw.length > 1) {
      fanOut(i, raw);
      return;
    }
    setDigit(i, raw);
    if (i < length - 1) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
      setDigit(i - 1, "");
    }
  }

  function handlePaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!/\d/.test(text)) return;
    e.preventDefault();
    fanOut(i, text);
  }

  return (
    <div className="otp-boxes">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          id={`${idPrefix}-${i}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          className="otp-box"
        />
      ))}
    </div>
  );
}

function Alert({ tone, icon, children }: { tone: "error" | "info" | "warning"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={`login-alert login-alert-${tone}`}
    >
      {icon}
      <span>{children}</span>
    </motion.div>
  );
}

function LoginForm() {
  const t = useTranslations("login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<"credentials" | "otp" | "totp">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [commitToken, setCommitToken] = useState<string | null>(null);
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
    setCommitToken(typeof data.commitToken === "string" ? data.commitToken : null);

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

    try {
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
        commitToken: commitToken ?? undefined,
        redirect: false,
      });

      if (!result?.error) {
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

      setError(verifyData.ok ? t("errors.finalizeError") : otpErrorMessage(verifyData.error ?? t("errors.generic")));
    } catch {
      // signIn()/fetch() above can throw outright — a network blip, or (per the comment
      // above) a non-2xx response whose JSON body got replaced by IIS's generic HTML error
      // page, which breaks next-auth's/our own response.json() parsing. Without this catch,
      // the thrown rejection left `loading` stuck true forever: the button just showed
      // "Verifying..." with no error and no way to retry short of reloading the page.
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
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
    <div className="login-page">
      <div className="login-bg" aria-hidden="true">
        <div className="login-orb login-orb-a" />
        <div className="login-orb login-orb-b" />
        <div className="login-orb login-orb-c" />
      </div>

      {/* Public, unauthenticated help entry points - someone who can't sign in (locked out,
          forgot password, no account yet) still needs a way to reach IT. Both targets are the
          existing public marketing-site pages (no login required), not the internal
          /dashboard/help-center or /dashboard/chat admin tools, which require an admin session
          and would just bounce back here. */}
      <div className="login-topbar">
        <Link href="/support" className="login-topbar-link">
          <BookOpen size={15} />
          Help Center
        </Link>
        <Link href="/support/tickets/new" className="login-topbar-link">
          <MessageCircle size={15} />
          Contact Support
        </Link>
      </div>

      <div className="login-center">
        <div className="login-composition">
          <div className="login-mascot">
            <div className="login-mascot-inner">
              <LoginMascot />
            </div>
          </div>

          <TiltCard>
          <div className="flex flex-col items-center" style={{ marginBottom: "1.75rem" }}>
            <div style={{ marginBottom: "0.85rem" }}>
              <TulipsLogo height={38} padded />
            </div>
            <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "var(--lp-ink)" }}>{t("heading")}</h1>
            <p style={{ fontSize: "0.85rem", color: "var(--lp-ink-muted)", margin: "0.35rem 0 0" }}>{t("brandSubtitle")}</p>
          </div>

          <AnimatePresence>
            {idleLogout && !error && (
              <Alert key="idle" tone="warning" icon={<Info size={16} />}>
                {t("idleLogoutMessage")}
              </Alert>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {error && (
              <Alert key="error" tone="error" icon={<AlertCircle size={16} />}>
                {error}
              </Alert>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {info && !error && (
              <Alert key="info" tone="info" icon={<Info size={16} />}>
                {info}
              </Alert>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {stage === "credentials" ? (
              <motion.form
                key="credentials"
                onSubmit={handleCredentialsSubmit}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                <FloatingInput
                  id="username"
                  label={t("usernameLabel")}
                  icon={<User size={17} />}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
                <FloatingInput
                  id="password"
                  label={t("passwordLabel")}
                  icon={<Lock size={17} />}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "inherit" }}
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-0.5rem", marginBottom: "0.75rem" }}>
                  <Link href="/forgot-password" style={{ fontSize: "0.78rem", color: "var(--lp-ink-muted)", textDecoration: "none" }}>
                    Forgot password?
                  </Link>
                </div>
                <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }} className="login-btn-primary" type="submit" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      {t("signingIn")}
                    </span>
                  ) : (
                    t("signIn")
                  )}
                </motion.button>
                {passkeySupported && (
                  <>
                    <div className="login-divider">
                      <span>or</span>
                    </div>
                    <div className="flex justify-center">
                      <motion.button
                        whileHover={passkeyLoading ? undefined : { scale: 1.08 }}
                        whileTap={passkeyLoading ? undefined : { scale: 0.92 }}
                        type="button"
                        className={`login-passkey-circle${passkeyLoading ? " loading" : ""}`}
                        onClick={handlePasskeySignIn}
                        disabled={passkeyLoading}
                        aria-label="Sign in with Face ID / Touch ID"
                        title="Sign in with Face ID / Touch ID"
                      >
                        <span className="login-passkey-ring" aria-hidden="true" />
                        {passkeyLoading ? <Loader2 size={22} className="animate-spin" /> : <Fingerprint size={22} />}
                      </motion.button>
                    </div>
                    <p className="login-passkey-caption">
                      {passkeyLoading ? "Waiting for Face ID / Touch ID…" : "Sign in with Face ID / Touch ID"}
                    </p>
                  </>
                )}
              </motion.form>
            ) : stage === "otp" ? (
              <motion.form
                key="otp"
                onSubmit={handleOtpSubmit}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex flex-col items-center" style={{ marginBottom: "1.1rem" }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.14)", color: "#fff", marginBottom: "0.6rem" }}>
                    <ShieldCheck size={20} />
                  </span>
                  <label htmlFor="otp-0" style={{ fontSize: "0.85rem", color: "var(--lp-ink-muted)", marginBottom: "0.75rem" }}>
                    {t("otpLabel")}
                  </label>
                  <OtpBoxes idPrefix="otp" value={otp} onChange={setOtp} disabled={loading} autoFocus />
                </div>
                <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }} className="login-btn-primary" type="submit" disabled={loading || otp.length !== 6}>
                  {loading ? t("verifying") : t("verify")}
                </motion.button>
                <button type="button" className="login-btn-ghost" onClick={handleResend} disabled={loading || resendSecondsLeft > 0}>
                  {resendSecondsLeft > 0 ? t("resendCodeWithSeconds", { seconds: resendSecondsLeft }) : t("resendCode")}
                </button>
                <button
                  type="button"
                  className="login-btn-ghost"
                  onClick={() => {
                    setStage("credentials");
                    setOtp("");
                    setError(null);
                    setInfo(null);
                  }}
                  disabled={loading}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <ArrowLeft size={14} />
                    {t("back")}
                  </span>
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="totp"
                onSubmit={handleOtpSubmit}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex flex-col items-center" style={{ marginBottom: "1.1rem" }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.14)", color: "#fff", marginBottom: "0.6rem" }}>
                    <KeyRound size={20} />
                  </span>
                  <label htmlFor={useRecoveryCode ? "recovery" : "totp-0"} style={{ fontSize: "0.85rem", color: "var(--lp-ink-muted)", marginBottom: "0.75rem" }}>
                    {useRecoveryCode ? t("recoveryCodeLabel") : t("totpLabel")}
                  </label>
                  {useRecoveryCode ? (
                    <FloatingInput
                      id="recovery"
                      label={t("recoveryCodeLabel")}
                      icon={<KeyRound size={17} />}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.toUpperCase())}
                      autoComplete="one-time-code"
                      required
                      autoFocus
                      maxLength={9}
                      placeholderWhenActive="XXXX-XXXX"
                      inputStyle={{ textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "monospace" }}
                    />
                  ) : (
                    <OtpBoxes idPrefix="totp" value={otp} onChange={setOtp} disabled={loading} autoFocus />
                  )}
                </div>
                <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }} className="login-btn-primary" type="submit" disabled={loading || otp.length === 0}>
                  {loading ? t("verifying") : t("verify")}
                </motion.button>
                <button
                  type="button"
                  className="login-btn-ghost"
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
                  className="login-btn-ghost"
                  onClick={() => {
                    setStage("credentials");
                    setOtp("");
                    setError(null);
                    setInfo(null);
                    setUseRecoveryCode(false);
                  }}
                  disabled={loading}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <ArrowLeft size={14} />
                    {t("back")}
                  </span>
                </button>
              </motion.form>
            )}
          </AnimatePresence>
          </TiltCard>
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
