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
  mailSecurityAccess = false,
  monitoringAccess = false,
  automationAccess = false,
  remoteAccessAccess = false,
  itAssetLogsheetAccess = false,
  browserActivityAccess = false,
  webAccessControlAccess = false,
  wifiAccessControlAccess = false,
  appActivityAccess = false,
  wazuhOfficeAccess = false,
  wafAccess = false,
  securityUpdatesAccess = false,
  serverRoomAccess = false,
  knowledgeBaseAccess = false,
  opsIncidentsAccess = false,
  securityAuditsAccess = false,
  databaseAnalyzerAccess = false,
  offboardingAccess = false,
  menuAccess = null,
}: {
  children: ReactNode;
  qaAccess?: boolean;
  codeQualityAccess?: boolean;
  laravelSecurityAccess?: boolean;
  mailSecurityAccess?: boolean;
  monitoringAccess?: boolean;
  automationAccess?: boolean;
  remoteAccessAccess?: boolean;
  itAssetLogsheetAccess?: boolean;
  browserActivityAccess?: boolean;
  webAccessControlAccess?: boolean;
  wifiAccessControlAccess?: boolean;
  appActivityAccess?: boolean;
  wazuhOfficeAccess?: boolean;
  wafAccess?: boolean;
  securityUpdatesAccess?: boolean;
  serverRoomAccess?: boolean;
  knowledgeBaseAccess?: boolean;
  opsIncidentsAccess?: boolean;
  securityAuditsAccess?: boolean;
  databaseAnalyzerAccess?: boolean;
  offboardingAccess?: boolean;
  menuAccess?: Record<string, boolean> | null;
}) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const mobileSidebar = useMobileSidebar();
  const isMobile = useIsMobile();
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [branding, setBranding] = useState<{ companyName: string | null; logoPath: string | null } | null>(null);

  useEffect(() => {
    setRailCollapsed(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
    setHydrated(true);
  }, []);

  // A white-labeled deployment's own configured logo/name (Settings > Company Profile), shown
  // here independent of the login page's own LoginBrandingEnabled toggle - once a company sets
  // this, their own name/logo should always appear in their own already-authenticated sidebar,
  // not just the public login screen. Best-effort: unset/failed fetch just keeps the Tulips
  // default rendered below.
  useEffect(() => {
    fetch("/api/public/branding")
      .then((r) => r.json())
      .then((res) => {
        if (res.ok && res.data?.logoPath) setBranding(res.data);
      })
      .catch(() => {});
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
      animate={{ width: collapsed ? 72 : 272 }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="dash-sidebar"
      style={{ overflow: "hidden" }}
    >
      <div
        className="brand"
        style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: collapsed ? "center" : "flex-start" }}
      >
        {collapsed ? (
          branding?.logoPath ? (
            <img
              src={branding.logoPath}
              alt={branding.companyName ?? "Company logo"}
              style={{ height: 20, width: 20, objectFit: "contain", flexShrink: 0 }}
            />
          ) : (
            <TulipsMark size={20} className="flex-shrink-0" />
          )
        ) : (
          <span style={{ flex: 1, minWidth: 0 }}>
            <TulipsLogo height={28} padded src={branding?.logoPath} alt={branding?.companyName} />
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

      <Sidebar
        collapsed={collapsed}
        onExpandRail={expandRail}
        qaAccess={qaAccess}
        codeQualityAccess={codeQualityAccess}
        laravelSecurityAccess={laravelSecurityAccess}
        mailSecurityAccess={mailSecurityAccess}
        monitoringAccess={monitoringAccess}
        automationAccess={automationAccess}
        remoteAccessAccess={remoteAccessAccess}
        itAssetLogsheetAccess={itAssetLogsheetAccess}
        browserActivityAccess={browserActivityAccess}
        webAccessControlAccess={webAccessControlAccess}
        wifiAccessControlAccess={wifiAccessControlAccess}
        appActivityAccess={appActivityAccess}
        wazuhOfficeAccess={wazuhOfficeAccess}
        wafAccess={wafAccess}
        securityUpdatesAccess={securityUpdatesAccess}
        serverRoomAccess={serverRoomAccess}
        knowledgeBaseAccess={knowledgeBaseAccess}
        opsIncidentsAccess={opsIncidentsAccess}
        securityAuditsAccess={securityAuditsAccess}
        databaseAnalyzerAccess={databaseAnalyzerAccess}
        offboardingAccess={offboardingAccess}
        menuAccess={menuAccess}
      />

      <div style={{ display: collapsed ? "none" : "block" }}>{children}</div>
    </motion.aside>
  );
}
