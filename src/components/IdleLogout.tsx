"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

// 15 minutes of no mouse/keyboard/scroll/touch activity anywhere in the dashboard signs
// the user out automatically — this app now surfaces screenshots and other sensitive
// endpoint data, so an unattended logged-in session left open is a real exposure risk.
// Overridable via Security Settings > Session Timeout (falls back to this default if unset
// or unreachable).
const DEFAULT_IDLE_TIMEOUT_MINUTES = 15;

// Checked on a short recurring interval (wall-clock elapsed time, not a single long-delay
// setTimeout) plus on visibilitychange/focus — a lone 15-minute setTimeout is exactly the
// kind of timer browsers throttle or suspend in a backgrounded tab, which would silently
// defeat the whole point of an idle-security timeout. Polling elapsed real time is immune
// to that: even a throttled interval still correctly detects "yes, it's been long enough"
// once it does run, and the visibilitychange/focus listeners catch it immediately the
// moment the user returns to a tab that was throttled while idle.
const CHECK_INTERVAL_MS = 15 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

export default function IdleLogout() {
  const lastActivityRef = useRef(Date.now());
  const timeoutMsRef = useRef(DEFAULT_IDLE_TIMEOUT_MINUTES * 60 * 1000);
  const signedOutRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/settings/security")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const minutes = data?.data?.SessionTimeoutMinutes;
        if (!cancelled && Number.isInteger(minutes) && minutes > 0) {
          timeoutMsRef.current = minutes * 60 * 1000;
        }
      })
      .catch(() => {
        // Couldn't load the admin-configured value — keep the 15-minute default.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function markActive() {
      lastActivityRef.current = Date.now();
    }

    function checkIdle() {
      if (signedOutRef.current) return;
      if (Date.now() - lastActivityRef.current >= timeoutMsRef.current) {
        signedOutRef.current = true;
        signOut({ callbackUrl: "/login?reason=idle" });
      }
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }
    document.addEventListener("visibilitychange", checkIdle);
    window.addEventListener("focus", checkIdle);
    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }
      document.removeEventListener("visibilitychange", checkIdle);
      window.removeEventListener("focus", checkIdle);
      clearInterval(interval);
    };
  }, []);

  return null;
}
