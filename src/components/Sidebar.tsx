"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUpDown, ChevronUp, ChevronDown, Check } from "lucide-react";
import { TOP_ITEMS, NAV_GROUPS, type NavItem, type NavGroup } from "@/lib/navRoutes";
import { loadNavOrder, saveNavOrder, applyOrder, moveItem, type SidebarOrder } from "@/lib/navOrder";

interface SidebarProps {
  collapsed: boolean;
  onExpandRail: () => void;
}

export default function Sidebar({ collapsed, onExpandRail }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  // Collapsed by default — except the group containing the current page, so navigating
  // straight to a page inside a group shows its submenu open without a click.
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((g) => [g.label, !g.items.some((i) => pathname.startsWith(i.href))]))
  );
  const [order, setOrder] = useState<SidebarOrder>({ topOrder: [], groupOrder: [], itemOrder: {} });
  const [reorderMode, setReorderMode] = useState(false);

  useEffect(() => {
    setOrder(loadNavOrder());
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
  const groups = applyOrder(NAV_GROUPS, (g) => g.label, order.groupOrder);

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
    <nav className="dash-nav">
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
              style={{ display: "flex", alignItems: "center", gap: "0.6rem", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}
            >
              <Icon size={17} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{t(`top.${item.key}`)}</span>}
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
                style={{
                  justifyContent: collapsed ? "center" : "flex-start",
                  color: groupHasActiveItem ? "var(--primary)" : undefined,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <GroupIcon size={16} style={{ flexShrink: 0 }} />
                {!collapsed && (
                  <>
                    <span style={{ flex: 1 }}>{t(`groups.${group.key}.label`)}</span>
                    {!reorderMode && <span className={`chevron ${isGroupCollapsed ? "collapsed" : ""}`}>&#9662;</span>}
                  </>
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
