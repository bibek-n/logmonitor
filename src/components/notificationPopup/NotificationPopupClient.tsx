"use client";

import { useEffect } from "react";

// A native Windows balloon tip (what this replaces) is capped at a few seconds by the OS
// itself regardless of what an app requests, and never fires a click event at all in the
// library previously used here - both are hard platform/library limits, not something
// tunable. This is a small app-mode browser window instead (see agent/tray_windows.go),
// which we fully control: it stays open until this timer closes it, or the employee clicks.
const AUTO_CLOSE_MS = 3 * 60 * 1000;

export default function NotificationPopupClient({
  deviceId,
  token,
  message,
}: {
  deviceId: string;
  token: string;
  message: string;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.close();
    }, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, []);

  function openChat() {
    // Resizes and navigates this SAME window to the full chat page, rather than opening a
    // second window - clicking the popup replaces it with the chat instead of leaving both
    // open. resizeTo is best-effort (some browser contexts restrict it); navigation always
    // works regardless.
    try {
      window.resizeTo(420, 640);
    } catch {
      // ignore
    }
    window.location.href = `/chat/${encodeURIComponent(deviceId)}?token=${encodeURIComponent(token)}`;
  }

  return (
    <div
      onClick={openChat}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") openChat();
      }}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "1.25rem",
        cursor: "pointer",
        background: "#1e1f22",
        color: "#f5f5f5",
        fontFamily: "system-ui, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          opacity: 0.65,
          marginBottom: "0.4rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Notification from Admin
      </div>
      <div style={{ fontSize: "0.95rem", lineHeight: 1.4, marginBottom: "0.75rem", wordBreak: "break-word" }}>
        {message}
      </div>
      <div style={{ fontSize: "0.72rem", opacity: 0.55 }}>Click to open chat</div>
    </div>
  );
}
