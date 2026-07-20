import { useEffect, useState } from "react";

// Shared client-side data-fetch hook for every Laravel Security list page (Projects, Scans,
// Issues) - same pattern as useCodeQualityList.ts (copied rather than imported so Laravel
// Security has no runtime dependency on the Code Quality module, matching "do not modify
// unrelated modules").
//
// Callers must reset page to 1 themselves when a filter value changes.

export interface LsListPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function useLaravelSecurityList<T>(basePath: string, extraParams: Record<string, string | undefined> = {}, pageSize = 25) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [rows, setRows] = useState<T[]>([]);
  const [pagination, setPagination] = useState<LsListPagination>({ page: 1, pageSize, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const extraKey = JSON.stringify(extraParams);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", String(pageSize));
    if (sortBy) {
      sp.set("sortBy", sortBy);
      sp.set("sortDir", sortDir);
    }
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) sp.set(k, v);
    }

    fetch(`${basePath}?${sp.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.ok) {
          setError(data.error ?? "Failed to load.");
          setRows([]);
          return;
        }
        setError(null);
        setRows(data.data ?? []);
        if (data.pagination) setPagination(data.pagination);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath, page, pageSize, sortBy, sortDir, extraKey, reloadTick]);

  function onSortChange(column: string) {
    setSortBy((prevSortBy) => {
      if (prevSortBy === column) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevSortBy;
      }
      setSortDir("desc");
      return column;
    });
    setPage(1);
  }

  function reload() {
    setReloadTick((t) => t + 1);
  }

  return { rows, pagination, loading, error, page, setPage, sortBy, sortDir, onSortChange, reload };
}
