"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, isValidTheme } from "@/lib/themes";

interface ThemeContextValue {
  theme: string;
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The no-flash inline script (see root layout) already set the DOM attribute before this
  // component mounts; read it back here so React state agrees with what's on screen instead
  // of re-flashing to the default while hydrating.
  const [theme, setThemeState] = useState<string>(DEFAULT_THEME);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (isValidTheme(current)) setThemeState(current);
  }, []);

  const setTheme = useCallback((id: string) => {
    setThemeState(id);
    document.documentElement.setAttribute("data-theme", id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // localStorage can throw in locked-down browser contexts; theme still applies for this
      // page load, it just won't persist — not worth failing the whole interaction over.
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
