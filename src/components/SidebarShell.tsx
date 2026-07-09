"use client";

import { useEffect, useState, ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight, Activity } from "lucide-react";
import Sidebar from "./Sidebar";

const SIDEBAR_COLLAPSE_KEY = "logmonitor-sidebar-collapsed";

export default function SidebarShell({ children }: { children: ReactNode }) {
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRailCollapsed(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
    setHydrated(true);
  }, []);

  // Avoid a mismatch between the SSR-rendered (always expanded) markup and the localStorage
  // preference read on mount — render expanded until hydration settles, then apply the stored
  // width. Trades a one-frame "always starts expanded" flash for zero hydration warnings.
  const collapsed = hydrated && railCollapsed;

  function toggleRail() {
    setRailCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  function expandRail() {
    setRailCollapsed(false);
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, "0");
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="dash-sidebar"
      style={{ overflow: "hidden" }}
    >
      <div
        className="brand"
        style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: collapsed ? "center" : "flex-start" }}
      >
        <Activity size={20} style={{ color: "var(--primary)", flexShrink: 0 }} />
        {!collapsed && <span style={{ whiteSpace: "nowrap" }}>Log Monitor</span>}
      </div>

      <Sidebar collapsed={collapsed} onExpandRail={expandRail} />

      <button
        type="button"
        onClick={toggleRail}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4rem",
          width: "100%",
          padding: "0.45rem 0.5rem",
          margin: "0.5rem 0",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--ink-muted)",
          cursor: "pointer",
          fontSize: "0.78rem",
        }}
      >
        {collapsed ? <ChevronsRight size={15} /> : (
          <>
            <ChevronsLeft size={15} />
            <span>Collapse</span>
          </>
        )}
      </button>

      <div style={{ display: collapsed ? "none" : "block" }}>{children}</div>
    </motion.aside>
  );
}
