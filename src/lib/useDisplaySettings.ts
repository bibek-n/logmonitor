"use client";

import { useEffect, useState } from "react";
import { DEFAULT_DISPLAY_SETTINGS, DisplaySettings } from "./dateFormat";

// Fetches the company-wide display preferences once per mount so timestamp columns (Last
// Checked, Next Check, etc.) render according to "the application host" configuration
// (CompanySettings > System Settings) instead of whatever timezone the viewer's own browser
// happens to be in. Falls back to DEFAULT_DISPLAY_SETTINGS (UTC) immediately so a render never
// blocks on this fetch - callers just re-render once the real settings arrive.
export function useDisplaySettings(): DisplaySettings {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/display-settings");
        const data = await res.json();
        if (!cancelled && res.ok && data.ok) setSettings(data.data);
      } catch {
        // Keep the default (UTC) settings - never break the page over this.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}
