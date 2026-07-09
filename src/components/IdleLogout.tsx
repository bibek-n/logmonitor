"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

// 15 minutes of no mouse/keyboard/scroll/touch activity anywhere in the dashboard signs
// the user out automatically — this app now surfaces screenshots and other sensitive
// endpoint data, so an unattended logged-in session left open is a real exposure risk.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

export default function IdleLogout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        signOut({ callbackUrl: "/login?reason=idle" });
      }, IDLE_TIMEOUT_MS);
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }
    resetTimer();

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return null;
}
