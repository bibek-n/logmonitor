"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MenuNode } from "@/lib/menuAccessTree";

// Recursive checkbox tree shared by the role-level and per-user Menu Access editors - purely
// presentational, the caller owns the actual node state and persistence.
export function MenuAccessTreeView({ tree, onToggle }: { tree: MenuNode[]; onToggle: (key: string, allowed: boolean) => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderNode(node: MenuNode, depth: number) {
    const hasChildren = !!node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.key);
    return (
      <div key={node.key}>
        <div className="flex items-center gap-2" style={{ paddingLeft: depth * 18, paddingTop: 3, paddingBottom: 3 }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpanded(node.key)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", padding: 0, display: "flex" }}
            >
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          ) : (
            <span style={{ width: 13 }} />
          )}
          <input type="checkbox" checked={node.allowed} onChange={(e) => onToggle(node.key, e.target.checked)} />
          <span style={{ fontSize: depth === 0 ? "0.85rem" : "0.8rem", fontWeight: depth === 0 ? 600 : 400, color: "var(--ink)" }}>{node.label}</span>
        </div>
        {hasChildren && isExpanded && node.children!.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return <div className="flex flex-col" style={{ maxHeight: "60vh", overflowY: "auto" }}>{tree.map((node) => renderNode(node, 0))}</div>;
}
