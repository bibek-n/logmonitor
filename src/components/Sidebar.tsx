"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUpDown, ChevronUp, ChevronDown, Check } from "lucide-react";
import { TOP_ITEMS, NAV_GROUPS, type NavItem, type NavGroup } from "@/lib/navRoutes";
import { loadNavOrder, saveNavOrder, applyOrder, moveItem, type SidebarOrder } from "@/lib/navOrder";
import { labelStyle } from "./sidebarLabelStyle";

interface SidebarProps {
  collapsed: boolean;
  onExpandRail: () => void;
  qaAccess?: boolean;
  codeQualityAccess?: boolean;
  laravelSecurityAccess?: boolean;
}

export default function Sidebar({ collapsed, onExpandRail, qaAccess = false, codeQualityAccess = false, laravelSecurityAccess = false }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  // Every group is visible to every authenticated user except "qaTesting" (gated by qa_view),
  // "codeQuality" (gated by cq_view), and "laravelSecurity" (gated by ls_view) - all resolved
  // server-side in DashboardLayout and threaded down through SidebarShell.
  const visibleNavGroups = NAV_GROUPS.filter(
    (g) => (g.key !== "qaTesting" || qaAccess) && (g.key !== "codeQuality" || codeQualityAccess) && (g.key !== "laravelSecurity" || laravelSecurityAccess)
  );
  // Collapsed by default — except the group containing the current page, so navigating
  // straight to a page inside a group shows its submenu open without a click.
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(visibleNavGroups.map((g) => [g.label, !g.items.some((i) => pathname.startsWith(i.href))]))
  );
  const [order, setOrder] = useState<SidebarOrder>({ topOrder: [], groupOrder: [], itemOrder: {} });
  const [reorderMode, setReorderMode] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    setOrder(loadNavOrder());
  }, []);

  // Red badge on "Employee Chat" so a new message is visible from anywhere in the
  // dashboard, not just while already on the chat page - HeaderClient separately toasts
  // for the same unread messages, this just keeps the nav item itself lit up.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/admin/chat/unread");
        if (!res.ok) return;
        const data: { ok: boolean; count: number } = await res.json();
        if (!cancelled && data.ok) setUnreadChatCount(data.count);
      } catch {
        // Transient network hiccup - just try again on the next tick.
      }
    }
    poll();
    const id = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  function persist(next: SidebarOrder) {
    setOrder(next);
    saveNavOrder(next);
  }

  function expandGroupAndRail(label: string) {
    onExpandRail();
    setCollapsedGroups((c) => ({ ...c, [label]: false }));
  }

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  }

  const topItems = applyOrder(TOP_ITEMS, (i) => i.href, order.topOrder);
  const groups = applyOrder(visibleNavGroups, (g) => g.label, order.groupOrder);

  function moveTopItem(index: number, direction: "up" | "down") {
    const reordered = moveItem(topItems, index, direction);
    persist({ ...order, topOrder: reordered.map((i) => i.href) });
  }

  function moveGroup(index: number, direction: "up" | "down") {
    const reordered = moveItem(groups, index, direction);
    persist({ ...order, groupOrder: reordered.map((g) => g.label) });
  }

  function moveGroupItem(group: NavGroup, groupItems: NavItem[], index: number, direction: "up" | "down") {
    const reordered = moveItem(groupItems, index, direction);
    persist({ ...order, itemOrder: { ...order.itemOrder, [group.label]: reordered.map((i) => i.href) } });
  }

  const arrowBtnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    color: "var(--ink-muted)",
    cursor: "pointer",
    padding: 2,
    display: "flex",
  };

  return (
    <nav className="dash-nav" aria-label="Main navigation">
      {!collapsed && (
        <button
          type="button"
          onClick={() => setReorderMode((v) => !v)}
          title={reorderMode ? t("doneArranging") : t("arrangeMenu")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            width: "100%",
            padding: "0.35rem 0.6rem",
            marginBottom: "0.4rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: reorderMode ? "color-mix(in srgb, var(--primary) 16%, transparent)" : "transparent",
            color: reorderMode ? "var(--primary)" : "var(--ink-muted)",
            cursor: "pointer",
            fontSize: "0.75rem",
          }}
        >
          {reorderMode ? <Check size={13} /> : <ArrowUpDown size={13} />}
          {reorderMode ? t("doneArranging") : t("arrangeMenu")}
        </button>
      )}

      {topItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <div key={item.href} className="flex items-center" style={{ gap: "0.25rem" }}>
            <Link
              href={item.href}
              className={isActive(item.href) ? "active" : ""}
              title={collapsed ? t(`top.${item.key}`) : undefined}
              aria-current={isActive(item.href) ? "page" : undefined}
              style={{ display: "flex", alignItems: "center", gap: "0.6rem", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}
            >
              <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
                <Icon size={17} style={{ color: item.key === "employeeChat" && unreadChatCount > 0 ? "var(--danger)" : undefined }} />
                {item.key === "employeeChat" && unreadChatCount > 0 && (
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
              </span>
              <span style={labelStyle(collapsed, { color: item.key === "employeeChat" && unreadChatCount > 0 ? "var(--danger)" : undefined })}>
                {t(`top.${item.key}`)}
              </span>
              {item.key === "employeeChat" && unreadChatCount > 0 && !collapsed && (
                <span
                  style={{
                    marginLeft: "auto",
                    background: "var(--danger)",
                    color: "#fff",
                    borderRadius: 999,
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "0.05rem 0.4rem",
                    flexShrink: 0,
                  }}
                >
                  {unreadChatCount}
                </span>
              )}
            </Link>
            {reorderMode && !collapsed && (
              <div className="flex flex-col" style={{ flexShrink: 0 }}>
                <button type="button" style={arrowBtnStyle} disabled={index === 0} onClick={() => moveTopItem(index, "up")}>
                  <ChevronUp size={13} style={{ opacity: index === 0 ? 0.3 : 1 }} />
                </button>
                <button type="button" style={arrowBtnStyle} disabled={index === topItems.length - 1} onClick={() => moveTopItem(index, "down")}>
                  <ChevronDown size={13} style={{ opacity: index === topItems.length - 1 ? 0.3 : 1 }} />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {groups.map((group, groupIndex) => {
        const isGroupCollapsed = collapsedGroups[group.label];
        const GroupIcon = group.icon;
        const groupItems = applyOrder(group.items, (i) => i.href, order.itemOrder[group.label] ?? []);
        const groupHasActiveItem = groupItems.some((i) => isActive(i.href));
        return (
          <div key={group.label} className="dash-nav-group">
            <div className="flex items-center" style={{ gap: "0.25rem" }}>
              <button
                type="button"
                className="dash-nav-group-header"
                onClick={() =>
                  collapsed
                    ? expandGroupAndRail(group.label)
                    : setCollapsedGroups((c) => ({ ...c, [group.label]: !c[group.label] }))
                }
                title={collapsed ? t(`groups.${group.key}.label`) : undefined}
                aria-label={t(`groups.${group.key}.label`)}
                style={{
                  justifyContent: collapsed ? "center" : "flex-start",
                  color: groupHasActiveItem ? "var(--success)" : undefined,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <GroupIcon size={16} style={{ flexShrink: 0 }} />
                <span style={labelStyle(collapsed, { flex: 1 })}>{t(`groups.${group.key}.label`)}</span>
                {!reorderMode && (
                  <span
                    className={`chevron ${isGroupCollapsed ? "collapsed" : ""}`}
                    style={labelStyle(collapsed, { flexShrink: 0 })}
                  >
                    &#9662;
                  </span>
                )}
              </button>
              {reorderMode && !collapsed && (
                <div className="flex flex-col" style={{ flexShrink: 0 }}>
                  <button type="button" style={arrowBtnStyle} disabled={groupIndex === 0} onClick={() => moveGroup(groupIndex, "up")}>
                    <ChevronUp size={13} style={{ opacity: groupIndex === 0 ? 0.3 : 1 }} />
                  </button>
                  <button type="button" style={arrowBtnStyle} disabled={groupIndex === groups.length - 1} onClick={() => moveGroup(groupIndex, "down")}>
                    <ChevronDown size={13} style={{ opacity: groupIndex === groups.length - 1 ? 0.3 : 1 }} />
                  </button>
                </div>
              )}
            </div>
            {!collapsed && (!isGroupCollapsed || reorderMode) && (
              <div className="dash-nav-group-items">
                {groupItems.map((item, itemIndex) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.href} className="flex items-center" style={{ gap: "0.25rem" }}>
                      <Link
                        href={item.href}
                        className={isActive(item.href) ? "active" : ""}
                        aria-current={isActive(item.href) ? "page" : undefined}
                        style={{ display: "flex", alignItems: "center", gap: "0.55rem", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}
                      >
                        <Icon size={14} style={{ flexShrink: 0 }} />
                        <span>{t(`groups.${group.key}.items.${item.key}`)}</span>
                      </Link>
                      {reorderMode && (
                        <div className="flex flex-col" style={{ flexShrink: 0 }}>
                          <button type="button" style={arrowBtnStyle} disabled={itemIndex === 0} onClick={() => moveGroupItem(group, groupItems, itemIndex, "up")}>
                            <ChevronUp size={12} style={{ opacity: itemIndex === 0 ? 0.3 : 1 }} />
                          </button>
                          <button
                            type="button"
                            style={arrowBtnStyle}
                            disabled={itemIndex === groupItems.length - 1}
                            onClick={() => moveGroupItem(group, groupItems, itemIndex, "down")}
                          >
                            <ChevronDown size={12} style={{ opacity: itemIndex === groupItems.length - 1 ? 0.3 : 1 }} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
