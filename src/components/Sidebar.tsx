"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUpDown, ChevronUp, ChevronDown, Check, Search, X } from "lucide-react";
import { NAV_CATEGORIES, GATED_GROUP_KEYS, GATED_CATEGORY_KEYS, CATEGORY_ICONS, type NavEntry, type NavSubGroup, type NavLink } from "@/lib/navRoutes";
import { loadNavOrder, saveNavOrder, applyOrder, moveItem, type SidebarOrder } from "@/lib/navOrder";
import { labelStyle } from "./sidebarLabelStyle";

interface SidebarProps {
  collapsed: boolean;
  onExpandRail: () => void;
  qaAccess?: boolean;
  codeQualityAccess?: boolean;
  laravelSecurityAccess?: boolean;
  mailSecurityAccess?: boolean;
  monitoringAccess?: boolean;
  automationAccess?: boolean;
  remoteAccessAccess?: boolean;
  itAssetLogsheetAccess?: boolean;
  browserActivityAccess?: boolean;
}

const ACCESS_BY_GROUP_KEY: Record<string, keyof Omit<SidebarProps, "collapsed" | "onExpandRail">> = {
  [GATED_GROUP_KEYS.qaTesting]: "qaAccess",
  [GATED_GROUP_KEYS.codeQuality]: "codeQualityAccess",
  [GATED_GROUP_KEYS.laravelSecurity]: "laravelSecurityAccess",
  [GATED_GROUP_KEYS.mailProtection]: "mailSecurityAccess",
};

const ACCESS_BY_CATEGORY_KEY: Record<string, keyof Omit<SidebarProps, "collapsed" | "onExpandRail">> = {
  [GATED_CATEGORY_KEYS.websiteApiMonitoring]: "monitoringAccess",
  [GATED_CATEGORY_KEYS.automation]: "automationAccess",
  [GATED_CATEGORY_KEYS.remoteAccess]: "remoteAccessAccess",
  [GATED_CATEGORY_KEYS.itAssetLogsheet]: "itAssetLogsheetAccess",
  [GATED_CATEGORY_KEYS.browserActivity]: "browserActivityAccess",
};

function matches(text: string, query: string): boolean {
  return text.toLowerCase().includes(query);
}

export default function Sidebar({
  collapsed,
  onExpandRail,
  qaAccess = false,
  codeQualityAccess = false,
  laravelSecurityAccess = false,
  mailSecurityAccess = false,
  monitoringAccess = false,
  automationAccess = false,
  remoteAccessAccess = false,
  itAssetLogsheetAccess = false,
  browserActivityAccess = false,
}: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const access: Record<string, boolean> = { qaAccess, codeQualityAccess, laravelSecurityAccess, mailSecurityAccess, monitoringAccess, automationAccess, remoteAccessAccess, itAssetLogsheetAccess, browserActivityAccess };

  // Every subgroup is visible to every authenticated user except the ones gated by a
  // permission key (GATED_GROUP_KEYS) - resolved server-side in DashboardLayout and threaded
  // down through SidebarShell. Categories themselves are normally never gated - each one
  // usually has plenty of ungated entries even when a gated subgroup inside it is hidden -
  // except the categories listed in GATED_CATEGORY_KEYS, which have no such fallback.
  const visibleCategories = useMemo(
    () =>
      NAV_CATEGORIES.filter((category) => {
        const categoryGate = GATED_CATEGORY_KEYS[category.key as keyof typeof GATED_CATEGORY_KEYS];
        if (!categoryGate) return true;
        return access[ACCESS_BY_CATEGORY_KEY[categoryGate]];
      }).map((category) => ({
        ...category,
        items: category.items.filter((entry) => {
          const gatedFlag = GATED_GROUP_KEYS[entry.key as keyof typeof GATED_GROUP_KEYS];
          if (!gatedFlag) return true;
          return access[ACCESS_BY_GROUP_KEY[gatedFlag]];
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }),
      })),
    [qaAccess, codeQualityAccess, laravelSecurityAccess, mailSecurityAccess, monitoringAccess, automationAccess, remoteAccessAccess, itAssetLogsheetAccess, browserActivityAccess]
  );

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  }

  function categoryHasActive(category: (typeof visibleCategories)[number]) {
    return category.items.some((entry) => (entry.type === "link" ? isActive(entry.href) : entry.items.some((i) => isActive(i.href))));
  }
  function subGroupHasActive(sub: NavSubGroup) {
    return sub.items.some((i) => isActive(i.href));
  }

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(visibleCategories.map((c) => [c.key, !categoryHasActive(c)]))
  );
  const [collapsedSubGroups, setCollapsedSubGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      visibleCategories.flatMap((c) => c.items.filter((e): e is NavSubGroup => e.type === "group").map((g) => [g.key, !subGroupHasActive(g)]))
    )
  );
  const [order, setOrder] = useState<SidebarOrder>({ entryOrder: {}, itemOrder: {} });
  const [reorderMode, setReorderMode] = useState(false);
  const [query, setQuery] = useState("");
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

  function expandCategoryAndRail(key: string) {
    onExpandRail();
    setCollapsedCategories((c) => ({ ...c, [key]: false }));
  }

  function expandSubGroupAndRail(key: string) {
    onExpandRail();
    setCollapsedSubGroups((c) => ({ ...c, [key]: false }));
  }

  function moveEntry(categoryKey: string, entries: NavEntry[], index: number, direction: "up" | "down") {
    const reordered = moveItem(entries, index, direction);
    persist({ ...order, entryOrder: { ...order.entryOrder, [categoryKey]: reordered.map((e) => e.key) } });
  }

  function moveSubItem(subGroupKey: string, items: NavLink[], index: number, direction: "up" | "down") {
    const reordered = moveItem(items, index, direction);
    persist({ ...order, itemOrder: { ...order.itemOrder, [subGroupKey]: reordered.map((i) => i.href) } });
  }

  const arrowBtnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    color: "var(--ink-muted)",
    cursor: "pointer",
    padding: 2,
    display: "flex",
  };

  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;

  return (
    <nav className="dash-nav" aria-label="Main navigation">
      {!collapsed && (
        <>
          <div style={{ position: "relative", marginBottom: "0.5rem" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchNav")}
              aria-label={t("searchNav")}
              className="dash-nav-search"
              style={{ paddingLeft: "1.85rem", paddingRight: query ? "1.85rem" : "0.65rem" }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("clearSearch")}
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", display: "flex" }}
              >
                <X size={14} />
              </button>
            )}
          </div>

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
              marginBottom: "0.5rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: reorderMode ? "color-mix(in srgb, var(--sidebar-accent) 16%, transparent)" : "transparent",
              color: reorderMode ? "var(--sidebar-accent)" : "var(--ink-muted)",
              cursor: "pointer",
              fontSize: "0.75rem",
            }}
          >
            {reorderMode ? <Check size={13} /> : <ArrowUpDown size={13} />}
            {reorderMode ? t("doneArranging") : t("arrangeMenu")}
          </button>
        </>
      )}

      {visibleCategories.map((category) => {
        const categoryLabel = t(`categories.${category.key}.label`);
        const entries = applyOrder(category.items, (e) => e.key, order.entryOrder[category.key] ?? []);

        // While searching, compute which entries (and, for subgroups, which child items)
        // match the query - a subgroup counts as matching if its own label matches OR any
        // child item does, and matching subgroups auto-expand to reveal the hit.
        type VisibleEntry = { entry: NavEntry; matchedItems: NavLink[] | null };
        const visibleEntries: VisibleEntry[] = searching
          ? entries
              .map((entry): VisibleEntry | null => {
                if (entry.type === "link") {
                  const label = t(`categories.${category.key}.entries.${entry.key}`);
                  return matches(label, trimmedQuery) ? { entry, matchedItems: null } : null;
                }
                const groupLabel = t(`categories.${category.key}.groups.${entry.key}.label`);
                const groupSelfMatches = matches(groupLabel, trimmedQuery);
                const matchedItems = entry.items.filter((item) => matches(t(`categories.${category.key}.groups.${entry.key}.items.${item.key}`), trimmedQuery));
                if (!groupSelfMatches && matchedItems.length === 0) return null;
                return { entry, matchedItems: groupSelfMatches ? entry.items : matchedItems };
              })
              .filter((v): v is VisibleEntry => v !== null)
          : entries.map((entry): VisibleEntry => ({ entry, matchedItems: null }));

        if (searching && visibleEntries.length === 0) return null;

        const isCategoryCollapsed = searching ? false : collapsedCategories[category.key];
        const CategoryIcon = CATEGORY_ICONS[category.key] ?? CATEGORY_ICONS.dashboard;

        return (
          <div key={category.key} className="dash-nav-category">
            <button
              type="button"
              className="dash-nav-category-header"
              onClick={() =>
                collapsed
                  ? expandCategoryAndRail(category.key)
                  : setCollapsedCategories((c) => ({ ...c, [category.key]: !c[category.key] }))
              }
              title={collapsed ? categoryLabel : undefined}
              aria-label={categoryLabel}
              aria-expanded={!isCategoryCollapsed}
              style={{ justifyContent: collapsed ? "center" : "flex-start" }}
            >
              <CategoryIcon size={14} style={{ flexShrink: 0 }} />
              <span style={labelStyle(collapsed, { flex: 1, fontWeight: 700 })}>{categoryLabel}</span>
              <span className={`chevron ${isCategoryCollapsed ? "collapsed" : ""}`} style={labelStyle(collapsed, { flexShrink: 0 })}>
                &#9662;
              </span>
            </button>

            <div className={`dash-nav-collapsible ${isCategoryCollapsed ? "" : "expanded"}`}>
              <div className="dash-nav-collapsible-inner">
                {!collapsed &&
                  visibleEntries.map(({ entry, matchedItems }, entryIndex) => {
                    if (entry.type === "link") {
                      const label = t(`categories.${category.key}.entries.${entry.key}`);
                      const Icon = entry.icon;
                      return (
                        <div key={entry.key} className="flex items-center" style={{ gap: "0.25rem" }}>
                          <Link href={entry.href} className={`dash-nav-entry-link ${isActive(entry.href) ? "active" : ""}`} aria-current={isActive(entry.href) ? "page" : undefined}>
                            <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
                              <Icon size={15} style={{ color: entry.key === "employeeChat" && unreadChatCount > 0 ? "var(--danger)" : undefined }} />
                              {entry.key === "employeeChat" && unreadChatCount > 0 && <span className="dash-nav-badge-dot" />}
                            </span>
                            <span style={{ flex: 1, color: entry.key === "employeeChat" && unreadChatCount > 0 ? "var(--danger)" : undefined }}>{label}</span>
                            {entry.key === "employeeChat" && unreadChatCount > 0 && <span className="dash-nav-badge-count">{unreadChatCount}</span>}
                          </Link>
                          {reorderMode && (
                            <div className="flex flex-col" style={{ flexShrink: 0 }}>
                              <button type="button" style={arrowBtnStyle} disabled={entryIndex === 0} onClick={() => moveEntry(category.key, entries, entryIndex, "up")}>
                                <ChevronUp size={12} style={{ opacity: entryIndex === 0 ? 0.3 : 1 }} />
                              </button>
                              <button
                                type="button"
                                style={arrowBtnStyle}
                                disabled={entryIndex === entries.length - 1}
                                onClick={() => moveEntry(category.key, entries, entryIndex, "down")}
                              >
                                <ChevronDown size={12} style={{ opacity: entryIndex === entries.length - 1 ? 0.3 : 1 }} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }

                    const groupLabel = t(`categories.${category.key}.groups.${entry.key}.label`);
                    const GroupIcon = entry.icon;
                    const items = applyOrder(entry.items, (i) => i.href, order.itemOrder[entry.key] ?? []);
                    const shownItems = searching && matchedItems ? items.filter((i) => matchedItems.some((m) => m.href === i.href)) : items;
                    const isSubGroupCollapsed = searching ? false : collapsedSubGroups[entry.key];

                    return (
                      <div key={entry.key} className="dash-nav-subgroup">
                        <div className="flex items-center" style={{ gap: "0.25rem" }}>
                          <button
                            type="button"
                            className="dash-nav-subgroup-header"
                            onClick={() =>
                              collapsed ? expandSubGroupAndRail(entry.key) : setCollapsedSubGroups((c) => ({ ...c, [entry.key]: !c[entry.key] }))
                            }
                            aria-expanded={!isSubGroupCollapsed}
                            style={{ flex: 1, minWidth: 0 }}
                          >
                            <GroupIcon size={14} style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1, textAlign: "left" }}>{groupLabel}</span>
                            {!reorderMode && <span className={`chevron ${isSubGroupCollapsed ? "collapsed" : ""}`}>&#9662;</span>}
                          </button>
                          {reorderMode && (
                            <div className="flex flex-col" style={{ flexShrink: 0 }}>
                              <button type="button" style={arrowBtnStyle} disabled={entryIndex === 0} onClick={() => moveEntry(category.key, entries, entryIndex, "up")}>
                                <ChevronUp size={12} style={{ opacity: entryIndex === 0 ? 0.3 : 1 }} />
                              </button>
                              <button
                                type="button"
                                style={arrowBtnStyle}
                                disabled={entryIndex === entries.length - 1}
                                onClick={() => moveEntry(category.key, entries, entryIndex, "down")}
                              >
                                <ChevronDown size={12} style={{ opacity: entryIndex === entries.length - 1 ? 0.3 : 1 }} />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className={`dash-nav-collapsible ${isSubGroupCollapsed ? "" : "expanded"}`}>
                          <div className="dash-nav-collapsible-inner">
                            {shownItems.map((item, itemIndex) => {
                              const ItemIcon = item.icon;
                              return (
                                <div key={item.href} className="flex items-center" style={{ gap: "0.25rem" }}>
                                  <Link href={item.href} className={`dash-nav-subitem-link ${isActive(item.href) ? "active" : ""}`} aria-current={isActive(item.href) ? "page" : undefined}>
                                    <ItemIcon size={13} style={{ flexShrink: 0 }} />
                                    <span>{t(`categories.${category.key}.groups.${entry.key}.items.${item.key}`)}</span>
                                  </Link>
                                  {reorderMode && (
                                    <div className="flex flex-col" style={{ flexShrink: 0 }}>
                                      <button type="button" style={arrowBtnStyle} disabled={itemIndex === 0} onClick={() => moveSubItem(entry.key, items, itemIndex, "up")}>
                                        <ChevronUp size={11} style={{ opacity: itemIndex === 0 ? 0.3 : 1 }} />
                                      </button>
                                      <button
                                        type="button"
                                        style={arrowBtnStyle}
                                        disabled={itemIndex === items.length - 1}
                                        onClick={() => moveSubItem(entry.key, items, itemIndex, "down")}
                                      >
                                        <ChevronDown size={11} style={{ opacity: itemIndex === items.length - 1 ? 0.3 : 1 }} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
