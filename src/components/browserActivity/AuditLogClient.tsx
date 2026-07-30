"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";

interface AuditLogRow {
  Id: number;
  Username: string;
  Action: string;
  Details: string | null;
  IpAddress: string | null;
  CreatedAt: string;
}

export function AuditLogClient() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 50;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/browser-activity/audit-log?page=${page}&pageSize=${pageSize}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) {
          setRows(data.data.entries);
          setTotal(data.data.total);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: "0.6rem 0.9rem", borderBottom: "1px solid var(--border)", fontSize: "0.78rem", color: "var(--ink-muted)" }}>
        Every view, search, export, and modification against this module - not just mutations. {total} total entries.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.5rem 0.8rem", color: "var(--ink-muted)", fontWeight: 500 }}>When</th>
              <th style={{ padding: "0.5rem 0.8rem", color: "var(--ink-muted)", fontWeight: 500 }}>User</th>
              <th style={{ padding: "0.5rem 0.8rem", color: "var(--ink-muted)", fontWeight: 500 }}>Action</th>
              <th style={{ padding: "0.5rem 0.8rem", color: "var(--ink-muted)", fontWeight: 500 }}>Details</th>
              <th style={{ padding: "0.5rem 0.8rem", color: "var(--ink-muted)", fontWeight: 500 }}>IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: "1rem", textAlign: "center", color: "var(--ink-muted)" }}>Loading...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "1rem", textAlign: "center", color: "var(--ink-muted)" }}>No audit entries yet.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0.8rem", whiteSpace: "nowrap" }}>{new Date(r.CreatedAt).toLocaleString()}</td>
                  <td style={{ padding: "0.5rem 0.8rem" }}>{r.Username}</td>
                  <td style={{ padding: "0.5rem 0.8rem", textTransform: "capitalize" }}>{r.Action.replace(/_/g, " ")}</td>
                  <td style={{ padding: "0.5rem 0.8rem", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.Details ?? ""}>
                    {r.Details ?? "—"}
                  </td>
                  <td style={{ padding: "0.5rem 0.8rem" }}>{r.IpAddress ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between" style={{ padding: "0.6rem 0.9rem", borderTop: "1px solid var(--border)", fontSize: "0.8rem" }}>
        <span>Page {page} of {totalPages}</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: "0.3rem 0.7rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", opacity: page <= 1 ? 0.5 : 1 }}>
            Prev
          </button>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ padding: "0.3rem 0.7rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", opacity: page >= totalPages ? 0.5 : 1 }}>
            Next
          </button>
        </div>
      </div>
    </Card>
  );
}
