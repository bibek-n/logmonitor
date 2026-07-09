"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOP_ITEMS, NAV_GROUPS } from "@/lib/navRoutes";

interface SidebarProps {
  collapsed: boolean;
  onExpandRail: () => void;
}

export default function Sidebar({ collapsed, onExpandRail }: SidebarProps) {
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  function expandGroupAndRail(label: string) {
    onExpandRail();
    setCollapsedGroups((c) => ({ ...c, [label]: false }));
  }

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  }

  return (
    <nav className="dash-nav">
      {TOP_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive(item.href) ? "active" : ""}
            title={collapsed ? item.label : undefined}
            style={{ display: "flex", alignItems: "center", gap: "0.6rem", whiteSpace: "nowrap" }}
          >
            <Icon size={17} style={{ flexShrink: 0 }} />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}

      {NAV_GROUPS.map((group) => {
        const isGroupCollapsed = collapsedGroups[group.label];
        const GroupIcon = group.icon;
        const groupHasActiveItem = group.items.some((i) => isActive(i.href));
        return (
          <div key={group.label} className="dash-nav-group">
            <button
              type="button"
              className="dash-nav-group-header"
              onClick={() =>
                collapsed
                  ? expandGroupAndRail(group.label)
                  : setCollapsedGroups((c) => ({ ...c, [group.label]: !c[group.label] }))
              }
              title={collapsed ? group.label : undefined}
              style={{
                justifyContent: collapsed ? "center" : "flex-start",
                color: groupHasActiveItem ? "var(--primary)" : undefined,
              }}
            >
              <GroupIcon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <>
                  <span style={{ flex: 1 }}>{group.label}</span>
                  <span className={`chevron ${isGroupCollapsed ? "collapsed" : ""}`}>&#9662;</span>
                </>
              )}
            </button>
            {!collapsed && !isGroupCollapsed && (
              <div className="dash-nav-group-items">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={isActive(item.href) ? "active" : ""}
                      style={{ display: "flex", alignItems: "center", gap: "0.55rem", whiteSpace: "nowrap" }}
                    >
                      <Icon size={14} style={{ flexShrink: 0 }} />
                      <span>{item.label}</span>
                    </Link>
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
