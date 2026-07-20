"use client";

import { useEffect, useState, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import Sidebar from "./Sidebar";
import { useMobileSidebar } from "./MobileSidebarContext";
import { labelStyle } from "./sidebarLabelStyle";
import { TulipsMark } from "./branding/TulipsMark";
import { TulipsLogo } from "./branding/TulipsLogo";

const SIDEBAR_COLLAPSE_KEY = "logmonitor-sidebar-collapsed";
const MOBILE_BREAKPOINT = "(max-width: 768px)";

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT);
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

export default function SidebarShell({
  children,
  qaAccess = false,
  codeQualityAccess = false,
  laravelSecurityAccess = false,
}: {
  children: ReactNode;
  qaAccess?: boolean;
  codeQualityAccess?: boolean;
  laravelSecurityAccess?: boolean;
}) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const mobileSidebar = useMobileSidebar();
  const isMobile = useIsMobile();
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRailCollapsed(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
    setHydrated(true);
  }, []);

  // Close the mobile off-canvas drawer whenever navigation completes, regardless of how
  // the user triggered it (nav link, breadcrumb, browser back/forward).
  useEffect(() => {
    mobileSidebar.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Avoid a mismatch between the SSR-rendered (always expanded) markup and the localStorage
  // preference read on mount — render expanded until hydration settles, then apply the stored
  // width. Trades a one-frame "always starts expanded" flash for zero hydration warnings.
  // On mobile, the drawer always opens as the full expanded overlay regardless of the
  // desktop icon-rail preference — a narrow icon-only overlay isn't a usable menu there.
  const collapsed = hydrated && railCollapsed && !(isMobile && mobileSidebar.open);

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
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="dash-sidebar"
      style={{ overflow: "hidden" }}
    >
      <div
        className="brand"
        style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: collapsed ? "center" : "flex-start" }}
      >
        {collapsed ? (
          <TulipsMark size={20} className="flex-shrink-0" />
        ) : (
          <span style={{ flex: 1, minWidth: 0 }}>
            <TulipsLogo height={28} padded />
          </span>
        )}
        <button
          type="button"
          onClick={mobileSidebar.close}
          className="dash-mobile-close"
          aria-label={t("collapseSidebar")}
          style={{ background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", display: "none" }}
        >
          <X size={18} />
        </button>
      </div>

      <button
        type="button"
        onClick={toggleRail}
        title={collapsed ? t("expandSidebar") : t("collapseSidebar")}
        aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
        aria-expanded={!collapsed}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4rem",
          width: "100%",
          padding: "0.45rem 0.5rem",
          margin: "0.6rem 0 0.75rem",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--ink-muted)",
          cursor: "pointer",
          fontSize: "0.78rem",
        }}
      >
        {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
        <span style={labelStyle(collapsed)}>{t("collapse")}</span>
      </button>

      <Sidebar collapsed={collapsed} onExpandRail={expandRail} qaAccess={qaAccess} codeQualityAccess={codeQualityAccess} laravelSecurityAccess={laravelSecurityAccess} />

      <div style={{ display: collapsed ? "none" : "block" }}>{children}</div>
    </motion.aside>
  );
}
