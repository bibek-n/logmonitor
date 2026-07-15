"use client";

import { ReactNode, useState } from "react";
import { MobileSidebarContext } from "./MobileSidebarContext";
import { ToastProvider } from "./ui/Toast";
import FloatingChatWidget from "./chat/FloatingChatWidget";

export default function DashShellClient({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const value = {
    open,
    toggle: () => setOpen((v) => !v),
    close: () => setOpen(false),
  };

  return (
    <MobileSidebarContext.Provider value={value}>
      <ToastProvider>
        <div className="dash-shell" data-mobile-sidebar-open={open}>
          {children}
          {open && <div className="dash-mobile-backdrop" onClick={value.close} />}
        </div>
        <FloatingChatWidget />
      </ToastProvider>
    </MobileSidebarContext.Provider>
  );
}
