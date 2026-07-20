"use client";

import { ReactNode, useEffect, useState } from "react";
import { ChevronUp, ChevronDown, Settings2 } from "lucide-react";
import { Card } from "@/components/ui/Card";

// Same shape as QaTable.tsx (QA Testing was the first module to introduce a shared list-table
// component in this app) - copied rather than imported so this module has no runtime
// dependency on QA, matching "do not modify unrelated modules." Search/filter inputs stay
// page-specific, rendered above this component by each page; this component owns the grid,
// sort headers, column visibility, row selection, and pagination footer.

export interface CqTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  hideByDefault?: boolean;
  render: (row: T) => ReactNode;
}

export interface CqTablePagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface CqTableProps<T> {
  storageKey: string;
  columns: CqTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => number;
  loading?: boolean;
  pagination: CqTablePagination;
  onPageChange: (page: number) => void;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSortChange?: (column: string) => void;
  selectedIds?: Set<number>;
  onSelectionChange?: (ids: Set<number>) => void;
  rowActions?: (row: T) => ReactNode;
  emptyMessage?: string;
}

function loadVisibleKeys(storageKey: string, columns: { key: string; hideByDefault?: boolean }[]): Set<string> {
  const allKeys = columns.map((c) => c.key);
  if (typeof window === "undefined") return new Set(allKeys.filter((k) => !columns.find((c) => c.key === k)?.hideByDefault));
  try {
    const raw = localStorage.getItem(`cq-table-columns:${storageKey}`);
    if (raw) {
      const saved: string[] = JSON.parse(raw);
      return new Set(saved.filter((k) => allKeys.includes(k)));
    }
  } catch {
    // fall through to default
  }
  return new Set(allKeys.filter((k) => !columns.find((c) => c.key === k)?.hideByDefault));
}

const thStyle: React.CSSProperties = { padding: "0.6rem 0.9rem", color: "var(--ink-muted)", fontWeight: 500, whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "0.6rem 0.9rem" };

export function CodeQualityTable<T>({
  storageKey,
  columns,
  rows,
  getRowId,
  loading = false,
  pagination,
  onPageChange,
  sortBy,
  sortDir = "desc",
  onSortChange,
  selectedIds,
  onSelectionChange,
  rowActions,
  emptyMessage = "No records found.",
}: CqTableProps<T>) {
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => loadVisibleKeys(storageKey, columns));
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(`cq-table-columns:${storageKey}`, JSON.stringify([...visibleKeys]));
    } catch {
      // localStorage unavailable (private browsing, etc.) - column visibility just won't persist
    }
  }, [storageKey, visibleKeys]);

  const visibleColumns = columns.filter((c) => visibleKeys.has(c.key));
  const selectable = !!onSelectionChange;
  const allOnPageSelected = selectable && rows.length > 0 && rows.every((r) => selectedIds?.has(getRowId(r)));
  const colSpan = visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  function toggleColumn(key: string) {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds ?? []);
    if (allOnPageSelected) {
      rows.forEach((r) => next.delete(getRowId(r)));
    } else {
      rows.forEach((r) => next.add(getRowId(r)));
    }
    onSelectionChange(next);
  }

  function toggleSelectRow(id: number) {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds ?? []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  return (
    <Card style={{ padding: 0 }}>
      <div className="flex items-center justify-between" style={{ padding: "0.55rem 0.9rem", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
          {selectable && selectedIds && selectedIds.size > 0 ? `${selectedIds.size} selected · ` : ""}
          {pagination.total} total
        </span>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setColumnMenuOpen((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.6rem", borderRadius: 6,
              border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink-secondary)",
              fontSize: "0.75rem", cursor: "pointer",
            }}
          >
            <Settings2 size={13} /> Columns
          </button>
          {columnMenuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setColumnMenuOpen(false)} />
              <div
                style={{
                  position: "absolute", right: 0, top: "110%", zIndex: 10, minWidth: 180, padding: "0.5rem",
                  borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)",
                  boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
                }}
              >
                {columns.map((c) => (
                  <label key={c.key} className="flex items-center gap-2" style={{ padding: "0.25rem 0", fontSize: "0.8rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={visibleKeys.has(c.key)} onChange={() => toggleColumn(c.key)} />
                    {c.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              {selectable && (
                <th style={thStyle}>
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} />
                </th>
              )}
              {visibleColumns.map((c) => (
                <th key={c.key} style={{ ...thStyle, cursor: c.sortable ? "pointer" : "default" }} onClick={() => c.sortable && onSortChange?.(c.key)}>
                  <span className="flex items-center gap-1">
                    {c.label}
                    {c.sortable && sortBy === c.key && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </span>
                </th>
              ))}
              {rowActions && <th style={thStyle} />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan} style={{ ...tdStyle, textAlign: "center", color: "var(--ink-muted)" }}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} style={{ ...tdStyle, textAlign: "center", color: "var(--ink-muted)" }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = getRowId(row);
                return (
                  <tr key={id} style={{ borderBottom: "1px solid var(--border)" }}>
                    {selectable && (
                      <td style={tdStyle}>
                        <input type="checkbox" checked={selectedIds?.has(id) ?? false} onChange={() => toggleSelectRow(id)} />
                      </td>
                    )}
                    {visibleColumns.map((c) => (
                      <td key={c.key} style={tdStyle}>
                        {c.render(row)}
                      </td>
                    ))}
                    {rowActions && <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{rowActions(row)}</td>}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between" style={{ padding: "0.6rem 0.9rem", borderTop: "1px solid var(--border)", fontSize: "0.8rem", color: "var(--ink-secondary)" }}>
        <span>
          Page {pagination.page} of {pagination.totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            style={{
              padding: "0.3rem 0.7rem", borderRadius: 6, border: "1px solid var(--border)",
              background: "var(--surface-2)", color: "var(--ink)", cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
              opacity: pagination.page <= 1 ? 0.5 : 1, fontSize: "0.78rem",
            }}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
            style={{
              padding: "0.3rem 0.7rem", borderRadius: 6, border: "1px solid var(--border)",
              background: "var(--surface-2)", color: "var(--ink)",
              cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer",
              opacity: pagination.page >= pagination.totalPages ? 0.5 : 1, fontSize: "0.78rem",
            }}
          >
            Next
          </button>
        </div>
      </div>
    </Card>
  );
}
