"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface AuditRow {
  Id: number;
  UserId: number | null;
  Username: string;
  Action: string;
  Details: string | null;
  IpAddress: string | null;
  CreatedAt: string;
}

export function WacAuditLogClient() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  const load = useCallback(async (p: number) => {
    const res = await fetch(`/api/admin/web-access-control/audit-log?page=${p}`);
    const data = await res.json();
    if (res.ok && data.ok) {
      setRows(data.data);
      setTotal(data.pagination?.total ?? 0);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      {rows === null ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No audit log entries yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ padding: "0.4rem" }}>When</th>
                <th style={{ padding: "0.4rem" }}>User</th>
                <th style={{ padding: "0.4rem" }}>Action</th>
                <th style={{ padding: "0.4rem" }}>Details</th>
                <th style={{ padding: "0.4rem" }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(r.CreatedAt + "Z").toLocaleString()}</td>
                  <td style={{ padding: "0.4rem" }}>{r.Username}</td>
                  <td style={{ padding: "0.4rem" }}>{r.Action}</td>
                  <td style={{ padding: "0.4rem", maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.Details ?? ""}>
                    {r.Details ?? "-"}
                  </td>
                  <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{r.IpAddress ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.85rem" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
          Page {page} of {totalPages} ({total} total)
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
        </div>
      </div>
    </Card>
  );
}
