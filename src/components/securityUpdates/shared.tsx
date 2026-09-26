import type { CSSProperties } from "react";

// Small helpers shared by the Security & Updates pages.

export const inputStyle: CSSProperties = {
  padding: "0.45rem 0.65rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export function categoryTone(category: string): Tone {
  switch (category) {
    case "critical":
    case "security":
      return "danger";
    case "kernel":
    case "firmware":
      return "warning";
    case "os":
    case "driver":
      return "info";
    default:
      return "neutral";
  }
}

export function severityTone(severity: string): Tone {
  switch (severity) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "info";
    default:
      return "neutral";
  }
}

export function osLabel(os: string | null | undefined): string {
  switch ((os ?? "").toLowerCase()) {
    case "windows":
      return "Windows";
    case "linux":
      return "Linux";
    case "darwin":
      return "macOS";
    default:
      return os ?? "Unknown";
  }
}

export const EVENT_LABELS: Record<string, string> = {
  scan_requested: "Scan requested",
  scan_completed: "Scan completed",
  update_found: "Update found",
  update_failed: "Update failed",
  update_installed: "Update installed / cleared",
  reboot_required: "Restart required",
  incident_linked: "Linked to incident",
  install_requested: "Install approved",
  install_started: "Install started",
  install_completed: "Install finished",
  update_install_failed: "Install failed",
  update_install_refused: "Install refused",
  update_install_skipped: "Install skipped",
  schedule_created: "Schedule created",
  schedule_run: "Schedule ran",
};

export function eventTone(eventType: string): Tone {
  switch (eventType) {
    case "update_failed":
    case "update_install_failed":
      return "danger";
    case "update_install_refused":
      return "warning";
    case "reboot_required":
      return "warning";
    case "update_installed":
      return "success";
    case "update_found":
      return "info";
    default:
      return "neutral";
  }
}

export const th: CSSProperties = { padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 };
export const td: CSSProperties = { padding: "0.4rem 0.6rem" };
