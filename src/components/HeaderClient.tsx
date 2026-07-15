"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, Bell, RefreshCw, X, Menu } from "lucide-react";
import { TOP_ITEMS, NAV_GROUPS } from "@/lib/navRoutes";
import ThemeSwitcher from "./ThemeSwitcher";
import { useMobileSidebar } from "./MobileSidebarContext";
import { useToast } from "./ui/Toast";
import type { AlertRow } from "@/lib/alerts";

const ALERTS_POLL_INTERVAL_MS = 6000;

function useBreadcrumb(pathname: string, overviewFallback: string): string[] {
  return useMemo(() => {
    const parts = pathname.split("/").filter(Boolean).slice(1); // drop "dashboard"
    if (parts.length === 0) return [overviewFallback];
    return parts.map((p) =>
      p
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    );
  }, [pathname, overviewFallback]);
}

const SEVERITY_COLOR: Record<string, string> = {
  warning: "var(--warning)",
  error: "var(--danger)",
  critical: "var(--danger)",
  alert: "var(--danger)",
  emergency: "var(--danger)",
};

export default function HeaderClient({
  userName,
  alerts: initialAlerts,
}: {
  userName: string;
  alerts: AlertRow[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("header");
  const tSidebar = useTranslations("sidebar");
  const breadcrumb = useBreadcrumb(pathname, t("overviewFallback"));
  const mobileSidebar = useMobileSidebar();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState(initialAlerts);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  // Deliberately NOT seeded from the max EventTime already in initialAlerts - a USB event
  // (or any alert) that landed a few seconds before this page loaded would already be in
  // that server-rendered list, which used to mean it was treated as "already seen" and
  // never got a toast at all, even though the admin was seeing it for the first time. A
  // short grace window before mount means anything genuinely recent still pops once,
  // while true backlog (alerts from hours/days ago) stays silent.
  const lastSeenRef = useRef<number>(Date.now() - 2 * 60 * 1000);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/admin/alerts/recent");
        if (!res.ok) return;
        const data: { alerts: AlertRow[] } = await res.json();
        if (cancelled) return;

        const fresh = data.alerts
          .filter((a) => new Date(a.EventTime).getTime() > lastSeenRef.current)
          .sort((a, b) => new Date(a.EventTime).getTime() - new Date(b.EventTime).getTime());

        for (const a of fresh) {
          toast.show({
            type: a.Severity === "critical" || a.Severity === "warning" ? "error" : "info",
            message: a.Detail,
            duration: 6000,
          });
        }
        if (fresh.length > 0) {
          lastSeenRef.current = Math.max(...fresh.map((a) => new Date(a.EventTime).getTime()));
        }
        setAlerts(data.alerts);
      } catch {
        // Transient network hiccup - just try again on the next tick.
      }
    }

    poll();
    const id = setInterval(poll, ALERTS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [toast]);

  const searchIndex = useMemo(() => {
    const mainGroup = tSidebar("searchMainGroup");
    return [
      ...TOP_ITEMS.map((i) => ({ href: i.href, label: tSidebar(`top.${i.key}`), group: mainGroup })),
      ...NAV_GROUPS.flatMap((g) => {
        const groupLabel = tSidebar(`groups.${g.key}.label`);
        return g.items.map((i) => ({ href: i.href, label: tSidebar(`groups.${g.key}.items.${i.key}`), group: groupLabel }));
      }),
    ];
  }, [tSidebar]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchIndex.filter((r) => r.label.toLowerCase().includes(q) || r.group.toLowerCase().includes(q)).slice(0, 8);
  }, [query, searchIndex]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 600);
  }

  const initial = userName.charAt(0).toUpperCase();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "0.75rem 1.5rem",
        background: "color-mix(in srgb, var(--surface) 85%, transparent)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <button
        type="button"
        onClick={mobileSidebar.toggle}
        aria-label={tSidebar("expandSidebar")}
        className="dash-mobile-menu-btn"
        style={{
          display: "none",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--ink-secondary)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <Menu size={17} />
      </button>

      <div style={{ minWidth: 0, flexShrink: 0 }}>
        <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--ink)" }}>
          {breadcrumb[breadcrumb.length - 1]}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
          {[t("breadcrumbRoot"), ...breadcrumb].join(" / ")}
        </div>
      </div>

      <div ref={searchRef} style={{ position: "relative", flex: 1, maxWidth: 420 }}>
        <div style={{ position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)" }} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder={t("searchPlaceholder")}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem 0.5rem 2rem",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--ink)",
              fontSize: "0.85rem",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer" }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        {searchOpen && query && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 0.5rem)",
              left: 0,
              right: 0,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "0.4rem",
              boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
              zIndex: 50,
            }}
          >
            {results.length === 0 ? (
              <div style={{ padding: "0.5rem", fontSize: "0.82rem", color: "var(--ink-muted)" }}>{t("noMatches")}</div>
            ) : (
              results.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  onClick={() => {
                    setQuery("");
                    setSearchOpen(false);
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.45rem 0.6rem",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: "var(--ink)",
                    fontSize: "0.85rem",
                  }}
                >
                  <span>{r.label}</span>
                  <span style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}>{r.group}</span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleRefresh}
        title={t("refreshTitle")}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--ink-secondary)",
          cursor: "pointer",
        }}
      >
        <RefreshCw size={15} style={{ animation: refreshing ? "spin 0.6s linear infinite" : undefined }} />
      </button>

      <div ref={notifRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setNotifOpen((o) => !o)}
          title={t("notificationsTitle")}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--ink-secondary)",
            cursor: "pointer",
          }}
        >
          <Bell size={15} />
          {alerts.length > 0 && (
            <span
              style={{
                position: "absolute",
                top: -3,
                right: -3,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--danger)",
                border: "2px solid var(--surface)",
              }}
            />
          )}
        </button>
        {notifOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 0.5rem)",
              width: 320,
              maxHeight: 360,
              overflowY: "auto",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "0.5rem",
              boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
              zIndex: 50,
            }}
          >
            <div style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)" }}>
              {t("recentAlerts")}
            </div>
            {alerts.length === 0 ? (
              <div style={{ padding: "0.5rem", fontSize: "0.82rem", color: "var(--ink-muted)" }}>{t("noAlerts")}</div>
            ) : (
              alerts.map((a, i) => (
                <div key={i} style={{ padding: "0.5rem", borderTop: "1px solid var(--border)", fontSize: "0.8rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: SEVERITY_COLOR[a.Severity] ?? "var(--ink-muted)", display: "inline-block" }} />
                    <span style={{ color: "var(--ink-muted)", fontSize: "0.72rem" }}>{new Date(a.EventTime).toLocaleString()}</span>
                  </div>
                  <div style={{ color: "var(--ink)" }}>{a.Detail}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <ThemeSwitcher />

      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "var(--primary)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.85rem",
          fontWeight: 700,
          flexShrink: 0,
        }}
        title={userName}
      >
        {initial}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </header>
  );
}
