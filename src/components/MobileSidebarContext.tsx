"use client";

import { createContext, useContext } from "react";

export interface MobileSidebarContextValue {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

export const MobileSidebarContext = createContext<MobileSidebarContextValue | null>(null);

export function useMobileSidebar(): MobileSidebarContextValue {
  const ctx = useContext(MobileSidebarContext);
  if (!ctx) throw new Error("useMobileSidebar must be used within DashShellClient");
  return ctx;
}
